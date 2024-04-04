const nameInput = document.getElementById('nameInput');
const submitButton = document.getElementById('submitButton');
const quitButton = document.getElementById('quitButton');
const playAgainButton = document.getElementById('playAgainButton');
const resultDiv = document.getElementById('result');
const imageDiv = document.getElementById('image-result');
const bestMatchDiv = document.getElementById('bestMatch');
const timedModeButton = document.getElementById('timedModeButton');
const challengeModeButton = document.getElementById('challengeModeButton');
const timerDisplay = document.getElementById('timer');
const score = document.getElementById('score');
const timeReward = 5;
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

let timeRemaining = gameDuration;
let timerInterval;
let currentScore = 0;
let isTimedMode = true;  // Default to timed mode initially
let stopwatchInterval;

const submittedNames = new Set();
const correctNames = new Set();
const incorrectNames = new Set();
const submittedWikidataIds = new Set();

const submissions = {};

window.addEventListener('DOMContentLoaded', initGradient);  //  After page loads
window.addEventListener('resize', updateGradient);  // Handle window resizing

function initGradient() {
  updateGradient();
}

submitButton.addEventListener('click', handleNameSubmission);
timedModeButton.addEventListener('click', closeIntroPopup);
challengeModeButton.addEventListener('click', closeIntroPopup);
quitButton.addEventListener('click', endGame);
playAgainButton.addEventListener('click', startGame);

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
  const resultsText = `I named ${correctNames.size} women!\r\n${
      Array.from(correctNames)
          .join(
              '\r\n')}\r\n\r\nHow many can you name?\r\nhttps://nameawoman.us`;
  navigator.clipboard.writeText(resultsText)
      .then(() => alert('Results copied!'))
      .catch(() => alert('Could not copy results'));
}

async function handleNameSubmission() {
  const name = nameInput.value.trim();
  if (name === '') {
    return;
  }

  nameInput.value = '';
  resultDiv.innerHTML = '<span id="checkingText">Searching...</span>';
  // Remove any existing image
  const imageElement = imageDiv.querySelector('img');
  if (imageElement) {
    imageElement.remove();
  }
  await checkSubmission(name);
}

async function checkSubmission(name) {
  if (submissions[name]) {
    handleRepeatSubmission(submissions[name], name);
    displayBestMatch(submissions[name]);
    return;
  }

  const match = await getBestMatch(name);
  submissions[name] = match;
  displayBestMatch(match);

  if (match.isDuplicate) {
    handleRepeatSubmission(match, name);
    return;
  }
  if (match.success) {
    resultDiv.innerHTML =
        `<span class="correct-result">${correctMessage}</span>`;
    correctNames.add(match.label);
    incrementScore();

    if (match.imageUrl) {
      // Create image element if it doesn't exist yet:
      if (!imageDiv.querySelector('img')) {
        const imageElement = document.createElement('img');
        imageElement.id = 'womanImage';
        imageElement.alt = match.label + ' from Wikipedia';
        imageDiv.appendChild(imageElement);
      }

      // Update image attributes
      const imageElement = imageDiv.querySelector('img');
      imageElement.src = match.imageUrl;
    }
    return;
  }
  if (match.displayable) {
    incorrectNames.add(match.label);
    if (match.isFemale) {
      resultDiv.innerHTML =
          `<span class="incorrect-result">${fictionalMessage}</span>`;
      return;
    }
    if (match.isHuman) {
      resultDiv.innerHTML =
          `<span class="incorrect-result">${genderErrorMessage}</span>`;
      return;
    }
  }
  incorrectNames.add(name);
  resultDiv.innerHTML = `<span class="incorrect-result">${errorMessage}</span>`;
}

function containsFemaleAttribute(claims) {
  const womanGenderIds =
      new Set(['Q6581072', 'Q1052281', 'Q4676163', 'Q575', 'Q43445', 'Q10675']);
  const transManId = 'Q2449503';

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

async function getBestMatch(name) {
  let greedyMatch = await getEntityByName(name);
  if (greedyMatch.success) {
    return greedyMatch;
  }
  const searchResults = await searchEntitiesByName(name);
  let matches = [];

  for (const key in searchResults) {
    let match = await getEntityById(searchResults[key].id);

    if (match.success) {
      return match;
    }
    if (match.displayable) {
      matches.push(match);
    }
  }
  if (greedyMatch.displayable) {
    return greedyMatch;
  }
  if (matches.length > 0) {
    return matches[0];
  }
  return getEmptyMatch();
}

async function searchEntitiesByName(name) {
  const searchLimit = 2;
  const searchQueryUrl =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${
          name}&language=en&limit=${searchLimit}&format=json&origin=*`;
  let data = await fetch(searchQueryUrl).then(response => response.json());
  return data.search;
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

function getEmptyMatch() {
  return {
    success: false,
    displayable: false,
    isHuman: false,
    isFemale: false,
    isDuplicate: false,
    label: null,
    wikiPage: null
  };
}

function getImageUrl(claims) {
  let imageUrl = null;
  if (claims.P18) {
    const imageClaim = claims.P18[0].mainsnak.datavalue.value;
    const imageFilename =
        imageClaim.replace(/\s/g, '_');  // Replace spaces for URL safety
    imageUrl = 'https://commons.wikimedia.org/w/thumb.php?width=200&f=' +
        imageFilename;
  }
  return imageUrl;
}

function fetchWikidataResponse(url) {
  return fetch(url)
      .then(response => response.json())
      .then(data => {
        const entities = data.entities;
        entityId = Object.keys(entities)[0];
        const claims = entities[entityId].claims;
        if (!claims) {
          return getEmptyMatch();
        }
        const isDuplicate = submittedWikidataIds.has(entityId);
        const isFemale = containsFemaleAttribute(claims);
        const isHuman = containsHumanAttribute(claims);
        const imageUrl = getImageUrl(claims);
        const enwikiSitelink = entities[entityId].sitelinks.enwiki;
        const wikiPage = enwikiSitelink ? enwikiSitelink.url : null;
        const label = entities[entityId].labels?.en?.value;

        submittedWikidataIds.add(entityId);
        return {
          success: (isHuman && isFemale && label && wikiPage) ? true : false,
          displayable: ((isHuman || isFemale) && label && wikiPage) ? true :
                                                                      false,
          isHuman: isHuman,
          isFemale: isFemale,
          isDuplicate: isDuplicate,
          label: label,
          wikiPage: wikiPage,
          imageUrl: imageUrl
        };
      })
      .catch(error => {
        console.log(error);
        return getEmptyMatch();
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
  }, 1000);
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
  clearResults();
}

function handleRepeatSubmission(match, name) {
  if (match.success) {
    resultDiv.innerHTML = `You already got a point for <a href="${
        match.wikiPage}">${match.label}</a>!`
  } else if (match.displayable) {
    resultDiv.innerHTML =
        `You already said <a href="${match.wikiPage}">${match.label}</a>!`
  } else {
    resultDiv.innerHTML = `You already said ${name}!`
  }
}

function displayBestMatch(match) {
  if (match.label && match.wikiPage) {
    bestMatchDiv.innerHTML = `The best match we found was <a href="${
        match.wikiPage}">${match.label}</a>.`;
  } else {
    bestMatchDiv.innerHTML = ``;
  }
}

function clearResults() {
  bestMatchDiv.innerHTML = ``;
  resultDiv.innerHTML = ``;
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

function enableInputAndButton() {
  nameInput.disabled = false;
  submitButton.disabled = false;
}

function closeIntroPopup() {
  document.getElementById('introPopup').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

function closeResultsPopup() {
  document.getElementById('resultsPopup').style.display = 'none';
}

function displayIntroPopup() {
  document.getElementById('introPopup').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
  let availableHeight = window.innerHeight * 0.8;  // 80% of screen height
  introPopup.style.maxHeight = availableHeight + 'px';

  const imageElement = imageDiv.querySelector('img');
  if (imageElement) {
    imageElement.remove();
  }
}

function startGame() {
  closeResultsPopup();
  enableInputAndButton();
  displayIntroPopup();
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

startGame();
