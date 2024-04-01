const nameInput = document.getElementById('nameInput');
const submitButton = document.getElementById('submitButton');
const resultDiv = document.getElementById('result');
const scoreDisplay = document.getElementById('score');

const errorMessage = 'We couldn\'t find that woman.';
const genderErrorMessage = 'Bro that\'s not a woman!';
const correctMessage = 'You named a woman!';
const fictionalMessage = 'Bruh that\'s a fictional character!';
const repeatMessage = 'Bruh you already said ';
const correctRepeatMessage = 'Bro you already got a point for ';

const timeReward = 5;
const gameDuration = 60;  // Time in seconds
let timeRemaining = gameDuration;
let timerInterval;  // To store the interval reference
let score = 0;

const submittedNames = new Set();
const correctNames = new Set();
const incorrectNames = new Set();
const submittedWikidataIds = new Set();

const womanGenderIds = new Set(['Q6581072', 'Q1052281', 'Q4676163', 'Q575']);
const transManId = 'Q2449503';

submitButton.addEventListener('click', verifyWomanWithWikidata);

nameInput.addEventListener('keypress', function(event) {
  if (event.key === 'Enter' || event.keyCode === 13) {  // Check for 'Enter' key
    event.preventDefault();  // Prevent default form submission
    verifyWomanWithWikidata();
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
  return parts.map(part => part[0].toUpperCase() + part.slice(1)).join('_');
}

function formatName(name) {
  const parts = name.split(' ');
  return parts.map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function verifyWomanWithWikidata() {
  const name = nameInput.value.toLowerCase();  // Convert to lowercase
  const reversedName = reverse(name);
  nameInput.value = '';  // Clear input field
  resultDiv.textContent = 'Checking...';

  if (submittedNames.has(name) || submittedNames.has(reversedName)) {
    submittedNames.add(reversedName);
    submittedNames.add(name);
    resultDiv.textContent = repeatMessage + formatName(name);
    return;
  }

  const nameParts = name.split(' ');
  const originalTitle = formatWikiPageTitle(name);

  let reversedTitle = null;
  if (nameParts.length > 1) {
    reversedTitle = formatWikiPageTitle(reversedName);
  }

  const originalPromise = checkWikidata(originalTitle);
  const reversedPromise =
      reversedTitle ? checkWikidata(reversedTitle) : Promise.resolve(null);

  Promise.all([originalPromise, reversedPromise])
      .then(([originalResult, reversedResult]) => {
        if ((originalResult && originalResult.isHuman &&
             originalResult.isWoman) ||
            (reversedResult && reversedResult.isHuman &&
             reversedResult.isWoman)) {
          if ((originalResult && originalResult.isDuplicate) ||
              (reversedResult && reversedResult.isDuplicate)) {
            resultDiv.textContent = correctRepeatMessage + formatName(name);
          } else {
            score++;
            scoreDisplay.textContent = score;
            resultDiv.textContent = correctMessage;
            correctNames.add(formatName(name));
            if (timeRemaining < 60) {
              timeRemaining += timeReward;
            }
          }
          if (originalResult.entityId) {
            submittedWikidataIds.add(originalResult.entityId);
          } else if (reversedResult.entityId) {
            submittedWikidataIds.add(reversedResult.entityId);
          }
        } else if (
            originalResult && !originalResult.isWoman &&
            originalResult.isHuman) {
          resultDiv.textContent = genderErrorMessage;
          incorrectNames.add(formatName(name));
        } else if (
            originalResult && !originalResult.isHuman &&
            originalResult.isWoman) {
          resultDiv.textContent = fictionalMessage;
          incorrectNames.add(formatName(name));
        } else if (
            reversedResult && !reversedResult.isWoman &&
            reversedResult.isHuman) {
          resultDiv.textContent = genderErrorMessage;
          incorrectNames.add(formatName(name));
        } else if (
            reversedResult && !reversedResult.isHuman &&
            reversedResult.isWoman) {
          resultDiv.textContent = fictionalMessage;
          incorrectNames.add(formatName(name));
        } else {
          resultDiv.textContent = errorMessage;
          incorrectNames.add(formatName(name));
        }
      })
      .catch(error => {
        resultDiv.textContent = errorMessage;
        incorrectNames.add(formatName(name));
        console.error(error);
      });

  submittedNames.add(reversedName);
  submittedNames.add(name);
}

function reverse(name) {
  const reversedName = name.split(' ').reverse().join(' ');
  return reversedName;
}

function checkWikidata(title) {
  const wikidataQueryUrl =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${
          title}&props=claims&format=json&origin=*&normalize=1`;


  return fetch(wikidataQueryUrl)
      .then(response => response.json())
      .then(data => {
        const entities = data.entities;

        let found = false;
        let isHuman = false;
        let isWoman = false;
        let isDuplicate = false;
        let entityId = null;

        if (!!entities) {
          entityId = Object.keys(entities)[0];
          const claims = entities[entityId].claims;

          if (submittedWikidataIds.has(entityId)) {
            isDuplicate = true;
          }

          found = true;
          if (claims.P21) {
            claims.P21.forEach(claim => {
              let id = claim.mainsnak.datavalue.value.id;
              if (womanGenderIds.has(id)) {
                isWoman = true;
              }
            });
            claims.P21.forEach(claim => {
              let id = claim.mainsnak.datavalue.value.id;
              if (id === transManId) {
                isWoman = false;
              }
            });
          }
          if (claims.P31) {
            const instanceOfValues =
                claims.P31.map(claim => claim.mainsnak.datavalue.value.id);
            if (instanceOfValues.includes('Q5')) {
              isHuman = true;
            }
          }
        }

        return {
          found: found,
          isHuman: isHuman,
          isWoman: isWoman,
          isDuplicate: isDuplicate,
          entityId: entityId
        };
      })
      .catch(error => {
        return {
          found: false,
          isHuman: false,
          isWoman: false,
          isDuplicate: false,
          entityId: null
        };
      });
}

function startTimer() {
  const timerDisplay = document.getElementById('timer');
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

function endGame() {
  clearInterval(timerInterval);
  disableInputAndButton();  // Prevent further submissions
  showResultsPopup();
}

function disableInputAndButton() {
  nameInput.disabled = true;
  submitButton.disabled = true;
}

startTimer();
