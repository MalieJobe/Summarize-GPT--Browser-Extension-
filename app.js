// Get references to the buttons and output field
const briefBtn = document.getElementById('brief-btn');
const mediumBtn = document.getElementById('medium-btn');
const detailedBtn = document.getElementById('detailed-btn');
const outputField = document.getElementById('output');

// Add click listeners to the buttons
briefBtn.addEventListener('click', function(){generateSummary(this)});
mediumBtn.addEventListener('click', function(){generateSummary(this)});
detailedBtn.addEventListener('click', function(){generateSummary(this)});

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