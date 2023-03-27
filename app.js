// Get references to the buttons and output field
const lengthSelectors = document.querySelectorAll('.button-container input[type="radio"]');
const outputField = document.getElementById('output');

// add onclick listeners to the buttons
for (let i = 0; i < lengthSelectors.length; i++) {
  lengthSelectors[i].onclick = function() {
    generateSummary(this.value);
  }
}

// run on extension open
generateSummary();


function saveCurrentTabsSummary(text) {
  // Get the current tab ID
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const tabId = tabs[0].id;

    // Save the generated summary for this tab
    chrome.storage.local.set({[tabId]: text});
  });
}

function retrieveCurrentTabsSummary() {
  // Get the current tab ID
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const tabId = tabs[0].id;

    // Retrieve the summary for this tab
    chrome.storage.local.get(tabId, function(result) {
      const summary = result[tabId];
      console.log('Summary retreived!');
      return summary;
    });
  });
}

// Functions to generate summary
async function generateSummary(element) {
  outputField.value = '';
  let prompt = await injectScriptIntoHost();
  await askGPT(prompt, (chunk) => {
    outputField.value += chunk
  });
}

function getPageContent() {
  let pageText = '';
  const pageNodes = document.querySelectorAll('body > :not(header):not(footer):not(style):not(script)') 
  
  for (let i = 0; i < pageNodes.length; i++) {
    if (pageNodes[i].tagName.includes('SVG')) continue; // not anything with svg like <my-svg-tag>. unable to filter this with css selector
    pageText += pageNodes[i].innerText + '\n';
  }
  return pageText;
}

function injectScriptIntoHost() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: getPageContent,
      })
        .then((injectionResults) => {
          resolve(injectionResults[0].result);
        })
        .catch((error) => {
          console.error(error);
          reject(error);
        });
    })
  });
}

async function askGPT(prompt, onChunk) {
  const response = await fetch('http://127.0.0.1:5000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'prompt': prompt,
      'stream': true,
    })
  });

  const reader = response.body.getReader();
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    let chunk = new TextDecoder().decode(value);
    let data = JSON.parse(chunk)['content']

    onChunk(data);

  }
}