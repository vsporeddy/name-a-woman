const nameInput = document.getElementById('nameInput');
const submitButton = document.getElementById('submitButton');
const resultDiv = document.getElementById('result');
const bestMatchDiv = document.getElementById('bestMatch');
const timedModeButton = document.getElementById('timedModeButton');
const challengeModeButton = document.getElementById('challengeModeButton');
const timerDisplay = document.getElementById('timer');
const score = document.getElementById('score');
const timeReward = 3;
const gameDuration = 60;  // Time in seconds for timed mode
const scoreLimit = 100;   // Score limit for challenge mode
const timeDisplay = document.getElementById('timeDisplay');
const timeLabel = document.getElementById('timeLabel');
const scoreDisplay = document.getElementById('scoreDisplay');

const errorMessage =
    'We couldn\'t find that woman on Wikipedia. We\'re not strict on spelling, but try your best!';
const genderErrorMessage =
    'This person\'s gender identity may not be categorized as "woman". Wikipedia isn\'t perfect, and gender identity is complex. If you think this is incorrect, please submit feedback!';
const correctMessage = 'You named a woman!';
const fictionalMessage =
    'Wikipedia seems to have this person categorized as fictional. If you think this is incorrect, please submit feedback!';
const repeatMessage = 'You already said ';
const correctRepeatMessage = 'You already got a point for ';

let timeRemaining = gameDuration;
let timerInterval;  // To store the interval reference
let currentScore = 0;
let isTimedMode = true;  // Default to timed mode initially
let stopwatchInterval;

const submittedNames = new Set();
const correctNames = new Set();
const incorrectNames = new Set();
const submittedWikidataIds = new Set();

const womanGenderIds =
    new Set(['Q6581072', 'Q1052281', 'Q4676163', 'Q575', 'Q43445', 'Q10675']);
const transManId = 'Q2449503';

window.addEventListener('DOMContentLoaded', initGradient);  //  After page loads
window.addEventListener('resize', updateGradient);  // Handle window resizing

function initGradient() {
  updateGradient();
}

submitButton.addEventListener('click', handleNameSubmission);
timedModeButton.addEventListener('click', closeIntroPopup);
challengeModeButton.addEventListener('click', closeIntroPopup);

nameInput.addEventListener('keypress', function(event) {
  if (event.key === 'Enter' || event.keyCode === 13) {  // Check for 'Enter' key
    event.preventDefault();  // Prevent default form submission
    handleNameSubmission();
  }
});

nameInput.addEventListener(
    'keydown', function() {                 // 'keydown' for any keypress
      if (!timerInterval && isTimedMode) {  // Check if timer isn't running yet
        startTimer();
      } else if (!stopwatchInterval && !isTimedMode) {
        startStopwatch();
      }
    });

function showResultsPopup() {
  document.getElementById('finalScore').textContent = correctNames.size;
  document.getElementById('womenNamed').textContent =
      '\r\n' + Array.from(correctNames).join('\r\n');
  document.getElementById('invalidGuesses').textContent =
      '\r\n' + Array.from(incorrectNames).join('\r\n');
  document.getElementById('resultsPopup').style.display = 'block';
}

function copyResults() {
  const resultsText = `I named ${correctNames.size} women in a minute!\r\n||${
      Array.from(correctNames)
          .join(
              '\r\n')}||\r\n\r\nHow many can you name?\r\nhttps://vsporeddy.github.io/name-a-woman/`;

  navigator.clipboard.writeText(resultsText)
      .then(() => alert('Results copied!'))
      .catch(() => alert('Could not copy results'));
}

function formatWikiPageTitle(name) {
  const parts = name.split(' ');
  return parts.map(part => part[0] + part.slice(1)).join('_');
  // const formattedName = name.replace(/[\.\,\-']/g, ''); // Remove '.', ',',
  // '-'
  return formattedName;
}

function formatName(name) {
  const parts = name.split(' ');
  return parts.map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

async function handleNameSubmission() {
  const name = nameInput.value;
  nameInput.value = '';
  resultDiv.innerHTML = '<span id="checkingText">Searching...</span>';

  if (submittedNames.has(name)) {
    resultDiv.textContent = repeatMessage + formatName(name) + '!';
    return;
  }
  submittedNames.add(name);

  let firstMatch = await getEntityByName(name);
  if (firstMatch.isHuman && firstMatch.isFemale && firstMatch.label && firstMatch.wikiPage) {
    handleValidSubmission(name, firstMatch.isDuplicate);
    displayBestMatch(firstMatch.label, firstMatch.wikiPage);
    return;
  }
  let searchMatch = await searchByName(name);
  if (searchMatch.isHuman && searchMatch.isFemale && searchMatch.label && searchMatch.wikiPage) {
    handleValidSubmission(name, searchMatch.isDuplicate);
    displayBestMatch(searchMatch.label, searchMatch.wikiPage);
    return;
  }
  if (firstMatch.isHuman && !firstMatch.isFemale && firstMatch.label && firstMatch.wikiPage) {
    handleNonFemaleSubmission(name);
    displayBestMatch(firstMatch.label, firstMatch.wikiPage);
    return;
  }
  if (!firstMatch.isHuman && firstMatch.isFemale && firstMatch.label && firstMatch.wikiPage) {
    handleFictionalSubmission(name);
    displayBestMatch(firstMatch.label, firstMatch.wikiPage);
    return;
  }
  if (searchMatch.isHuman && !searchMatch.isFemale && searchMatch.label && searchMatch.wikiPage) {
    handleNonFemaleSubmission(name);
    displayBestMatch(searchMatch.label, searchMatch.wikiPage);
    return;
  }
  if (!searchMatch.isHuman && searchMatch.isFemale && searchMatch.label && searchMatch.wikiPage) {
    handleFictionalSubmission(name);
    displayBestMatch(searchMatch.label, searchMatch.wikiPage);
    return;
  }

  displayBestMatch(null, null);
  handleInvalidSubmission(name);
}

function containsFemaleAttribute(claims) {
  let isFemale = false;
  if (claims && claims.P21) {  // Ensure the 'P21' (gender) property exists
    // Check if any gender IDs match recognized female-identifying IDs
    isFemale = claims.P21.some(claim => {
      let id = claim.mainsnak.datavalue.value.id;
      return womanGenderIds.has(id);
    });

    // Ensure none of the gender IDs match the 'trans man' ID.
    // Sometimes entries for trans man are still associated with
    // female-identifying IDs.
    isFemale = isFemale && !claims.P21.some(claim => {
      let id = claim.mainsnak.datavalue.value.id;
      return id === transManId;
    });
  }
  return isFemale;
}

function containsHumanAttribute(claims) {
  if (claims && claims.P31) {
    return claims.P31.some(claim => {
      const instanceId = claim.mainsnak.datavalue.value.id;
      return instanceId === 'Q5';
    });
  }
  return false;
}

async function searchByName(name) {
  const searchQueryUrl =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${
          name}&language=en&limit=2&format=json&origin=*`;

  let data = await fetch(searchQueryUrl).then(response => response.json());
  const results = data.search;
  resultsArr = [];
  for (const key in results) {
    let result = await getEntityById(results[key].id);
    if (result.isHuman && result.isFemale) {
      return result;
    }
    resultsArr.push(result)
  }
  if (resultsArr.length === 0) {
    return {
          isHuman: false,
          isFemale: false,
          isDuplicate: false,
          label: null,
          wikiPage: null
        }; 
  }
  return resultsArr[0];
}

function getEntityById(id) {
  const url =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&ids=${
          id}&props=labels|claims|sitelinks/urls&format=json&origin=*&normalize=1`;
  return fetchWikidataResponse(url);
}

function getEntityByName(name) {
  // searchWikidataByName(name);
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${
      name}&props=labels|claims|sitelinks/urls&format=json&origin=*&normalize=1`;
  return fetchWikidataResponse(url);
}

function fetchWikidataResponse(url) {
  return fetch(url)
      .then(response => response.json())
      .then(data => {
        const entities = data.entities;
        entityId = Object.keys(entities)[0];
        const claims = entities[entityId].claims;
        let isDuplicate = submittedWikidataIds.has(entityId);
        let isFemale = containsFemaleAttribute(claims);
        let isHuman = containsHumanAttribute(claims);

        const enwikiSitelink = entities[entityId].sitelinks.enwiki;
        const wikipediaUrl = enwikiSitelink ? enwikiSitelink.url : null;
        const label = entities[entityId].labels?.en?.value;

        submittedWikidataIds.add(entityId);
        return {
          isHuman: isHuman,
          isFemale: isFemale,
          isDuplicate: isDuplicate,
          label: label,
          wikiPage: wikipediaUrl
        };
      })
      .catch(error => {
        console.log(error);
        return {
          isHuman: false,
          isFemale: false,
          isDuplicate: false,
          label: null,
          wikiPage: null
        };
      });
}

timedModeButton.addEventListener('click', () => {
  isTimedMode = true;
  scoreDisplay.style.display = 'block';
  timeLabel.textContent = 'Remaining Time:';
  timeDisplay.style.display = 'block';
  score.textContent = 0;
  timerDisplay.textContent = '01:00';
});

challengeModeButton.addEventListener('click', () => {
  isTimedMode = false;
  scoreDisplay.style.display = 'block';
  timeLabel.textContent = 'Elapsed Time:';
  timeDisplay.style.display = 'block';
  score.textContent = 0;
  timerDisplay.textContent = '00:00';
});

function startTimer() {
  timeRemaining = gameDuration;  // Reset time when starting
  timerInterval = setInterval(() => {
    timeRemaining--;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    // Update display immediately if time changes
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${
        seconds.toString().padStart(2, '0')}`;

    if (timeRemaining === 0) {
      endGame();
    }
  }, 1000);
}

function startStopwatch() {
  let startTime = Date.now();
  stopwatchInterval = setInterval(() => {
    const elapsedTime = Date.now() - startTime;
    const formattedTime = formatTime(elapsedTime);
    timerDisplay.textContent = formattedTime;
  }, 1000);  // Update every 1000 milliseconds (1 second)
}

function formatTime(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${
      seconds.toString().padStart(2, '0')}`;
}

function endGame() {
  if (isTimedMode) {
    clearInterval(timerInterval);
  } else {
    clearInterval(stopwatchInterval);
  }
  disableInputAndButton();  // Prevent further submissions
  showResultsPopup();
}

function handleInvalidSubmission(name) {
  resultDiv.innerHTML = `<span class="incorrect-result">${errorMessage}</span>`;
  incorrectNames.add(formatName(name));
}

function handleNonFemaleSubmission(name) {
  resultDiv.innerHTML =
      `<span class="incorrect-result">${genderErrorMessage}</span>`;
  incorrectNames.add(formatName(name));
}

function handleFictionalSubmission(name) {
  resultDiv.innerHTML =
      `<span class="incorrect-result">${fictionalMessage}</span>`;
  incorrectNames.add(formatName(name));
}

function handleValidSubmission(name, isDuplicate) {
  if (isDuplicate) {
    resultDiv.textContent = correctRepeatMessage + formatName(name) + '!';
    return;
  }
  resultDiv.innerHTML = `<span class="correct-result">${correctMessage}</span>`;
  correctNames.add(formatName(name));
  incrementScore();
}

function displayBestMatch(label, url) {
  if (label && url) {
    bestMatchDiv.innerHTML =
        `The best match we found was <a href="${url}">${label}.</a>`;
  } else {
    bestMatchDiv.innerHTML = ``;
  }
}

function incrementScore() {
  currentScore++;
  score.textContent = currentScore;
  if (timeRemaining < 60 && isTimedMode) {
    timeRemaining += timeReward;
  }
  if (currentScore >= scoreLimit && !isTimedMode) {
    endGame();
  }
}

function disableInputAndButton() {
  nameInput.disabled = true;
  submitButton.disabled = true;
}

function closeIntroPopup() {
  document.getElementById('introPopup').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

function displayIntroPopup() {
  document.getElementById('introPopup').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
  var availableHeight = window.innerHeight * 0.8;  // 80% of screen height
  introPopup.style.maxHeight = availableHeight + 'px';
}

function updateGradient() {
  const overlay = document.getElementById('cream-overlay');
  const nameInput =
      document.querySelector('#nameInput');  // Target input element

  const inputRect = nameInput.getBoundingClientRect();
  const inputCenterX = inputRect.left + inputRect.width / 2;
  const inputCenterY = inputRect.top + inputRect.height / 2;
  const gradientSpread = Math.min(inputRect.width, inputRect.height) * 1.5;

  overlay.style.setProperty('--gradient-x', inputCenterX + 'px');
  overlay.style.setProperty('--gradient-y', inputCenterY + 'px');
  overlay.style.setProperty('--gradient-spread', gradientSpread + 'px');
}

displayIntroPopup();
