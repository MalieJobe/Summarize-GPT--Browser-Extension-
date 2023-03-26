// Get references to the buttons and output field
const briefBtn = document.getElementById('brief-btn');
const mediumBtn = document.getElementById('medium-btn');
const detailedBtn = document.getElementById('detailed-btn');
const outputField = document.getElementById('output');

// Add click listeners to the buttons
briefBtn.addEventListener('click', function(){generateSummary(this)});
mediumBtn.addEventListener('click', function(){generateSummary(this)});
detailedBtn.addEventListener('click', function(){generateSummary(this)});

// get api key from api_key.json file
const API_KEY = fetch('api_key.json')
  .then(response => response.json())
  .then(data => data.open_ai_key);

// Functions to generate summary
async function generateSummary(element) {
  outputField.value = '';
  let prompt = `Summarize ${element.value}. Use bullet points and other structure when deemed relevant. Text: """${await getPageContent()}"""`;
  await askGPT3(prompt, (chunk) => {
    outputField.value += chunk.replace(/\n/g, '\n')
  });
}

function getPageContent() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: function () {
          let pageText = '';
          document.querySelectorAll('body > :not(header):not(footer):not(style):not(script)')
            .forEach(function (node) {
              pageText += node.innerText + '\n';
            })
          return pageText;
        }
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

async function askGPT3(prompt, onChunk) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + await API_KEY,
    },
    body: JSON.stringify({
      'model': 'gpt-3.5-turbo',
      'messages': [
        {
          'role': 'user',
          'content': prompt
        }
      ],
      'temperature': 0,
      'n': 1,
      'stream': true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let chunk;
  while (({ value: chunk, done: isDone } = await reader.read()), !isDone) {
    const decodedChunk = decoder.decode(chunk);
    
    let content = '';
    const contentRegex = /"content":"(.*?)"/g;
    content = contentRegex.exec(decodedChunk);
    if (content) {
      onChunk(content[1]);
    }
  }
}
