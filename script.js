const nameInput = document.getElementById('nameInput');
const submitButton = document.getElementById('submitButton');
const resultDiv = document.getElementById('result');
const scoreDisplay = document.getElementById('score');

const errorMessage =
    'Bro that\'s not a woman or she doesn\'t have a Wikipedia page.';
const genderErrorMessage = 'Bro that\'s not a woman!';
const correctMessage = 'You named a woman!';
const alreadySubmittedMessage = 'Bruh you already said ';
const fictionalMessage = 'Bruh that\'s a fictional character!';
const repeatMessage = 'Bruh you already said ';

const timeReward = 10;
const gameDuration = 60;  // Time in seconds
let timeRemaining = gameDuration;
let timerInterval;  // To store the interval reference
let score = 0;

const submittedNames = new Set();
const correctNames = new Set();
const incorrectNames = new Set();

submitButton.addEventListener('click', verifyWomanWithWikidata);

nameInput.addEventListener('keypress', function(event) {
  if (event.key === 'Enter' || event.keyCode === 13) {  // Check for 'Enter' key
    event.preventDefault();  // Prevent default form submission
    verifyWomanWithWikidata();
  }
});

function showResultsPopup() {
  document.getElementById('finalScore').textContent = correctNames.size;
  // document.getElementById("nameList").textContent =
  // Array.from(correctNames).join("\r\n");
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
          score++;
          scoreDisplay.textContent = score;
          resultDiv.textContent = correctMessage;
          correctNames.add(formatName(name));
          timeRemaining += timeReward;
        } else if (originalResult && !originalResult.isWoman && originalResult.isHuman) {
          resultDiv.textContent = genderErrorMessage;
          incorrectNames.add(formatName(name));
        } else if (originalResult && !originalResult.isHuman && originalResult.isWoman) {
          resultDiv.textContent = fictionalMessage;
          incorrectNames.add(formatName(name));
        } else if (reversedResult && !reversedResult.isWoman && reversedResult.isHuman) {
          resultDiv.textContent = genderErrorMessage;
          incorrectNames.add(formatName(name));
        } else if (reversedResult && !reversedResult.isHuman && reversedResult.isWoman) {
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

        if (!!entities) {
          const entityId = Object.keys(entities)[0];
          const claims = entities[entityId].claims;

          found = true;
          if (claims.P21 &&
              claims.P21[0].mainsnak.datavalue.value.id === 'Q6581072') {
            isWoman = true;
          }
          if (claims.P31) {
            const instanceOfValues =
                claims.P31.map(claim => claim.mainsnak.datavalue.value.id);
            if (instanceOfValues.includes('Q5')) {
              isHuman = true;
            }
          }
        }

        return {found: found, isHuman: isHuman, isWoman: isWoman};
      })
      .catch(error => {
        return {found: false, isHuman: false, isWoman: false};
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
