const nameInput = document.getElementById("nameInput");
const submitButton = document.getElementById("submitButton");
const resultDiv = document.getElementById("result");
const scoreDisplay = document.getElementById("score");

const errorMessage = "Bro that's not a woman or she doesn't have a Wikipedia page.";
const genderErrorMessage = "Bro that's not a woman!"
const correctMessage = "You named a woman!"
const alreadySubmittedMessage = "Bruh you already said "

let score = 0;

const submittedNames = new Set(); 
const correctNames = new Set();
const incorrectNames = new Set();

submitButton.addEventListener('click', verifyWomanWithWikidata);

nameInput.addEventListener('keypress', function(event) {
    if (event.key === "Enter" || event.keyCode === 13) { // Check for 'Enter' key
        event.preventDefault(); // Prevent default form submission
        verifyWomanWithWikidata();
    }
});

function showResultsPopup() {
    document.getElementById("finalScore").textContent = correctNames.size;
    // document.getElementById("nameList").textContent = Array.from(correctNames).join("\r\n"); 
    document.getElementById("resultsPopup").style.display = "block"; 
}

function copyResults() {
    const resultsText = `I named ${correctNames.size} women in a minute!\r\n||${Array.from(correctNames).join("\r\n")}||\r\n\r\nHow many can you name?\r\nhttps://vsporeddy.github.io/name-a-woman/`;

    navigator.clipboard.writeText(resultsText)
      .then(() => alert("Results copied!"))
      .catch(() => alert("Could not copy results"));
}

function formatWikiPageTitle(name) {
  const parts = name.split(" ");
  return parts.map(part => part[0].toUpperCase() + part.slice(1)).join("_");
}

function formatName(name) {
  const parts = name.split(" ");
  return parts.map(part => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function verifyWomanWithWikidata() {
    const name = nameInput.value.toLowerCase(); // Convert to lowercase
    nameInput.value = ""; // Clear input field
    resultDiv.textContent = "Checking...";

    if (submittedNames.has(name)) { 
        resultDiv.textContent = "Bruh you already said " + formatName(name);
        return; 
    }

    submittedNames.add(name);

    const wikiPageTitle = formatWikiPageTitle(name); 
    const wikidataQueryUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${wikiPageTitle}&props=claims&format=json&origin=*`;
        console.log(wikidataQueryUrl);

    fetch(wikidataQueryUrl)
        .then(response => response.json())
        .then(data => {
            const entities = data.entities;
            if (!entities) {
                resultDiv.textContent = "Not found on Wikipedia.";
                return; 
            }

            const entityId = Object.keys(entities)[0];
            const gender = entities[entityId].claims.P21[0].mainsnak.datavalue.value.id;

            if (gender === "Q6581072") { 
                score++;
                scoreDisplay.textContent = score;
                resultDiv.textContent = correctMessage;
                correctNames.add(formatName(name));
            } else {
                resultDiv.textContent = genderErrorMessage;
                incorrectNames.add(formatName(name));
            }
        })
        .catch(error => {
            resultDiv.textContent = errorMessage;
            incorrectNames.add(formatName(name));
            console.error(error); 
        });
}

function reverse(name) {
    const reversedName = name.split(" ").reverse().join(" ");
    return reversedName;
}

const gameDuration = 60; // Time in seconds
let timeRemaining = gameDuration; 
let timerInterval; // To store the interval reference

function startTimer() {
    const timerDisplay = document.getElementById("timer"); 
    timerInterval = setInterval(() => {
        timeRemaining--;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; 

        if (timeRemaining === 0) {
            endGame();
        }
    }, 1000); 
}

function endGame() {
    clearInterval(timerInterval);
    disableInputAndButton(); // Prevent further submissions
    showResultsPopup();
}

function disableInputAndButton() {
    nameInput.disabled = true;
    submitButton.disabled = true; 
}

startTimer();
