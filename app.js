const output_toggle = document.getElementById('output_toggle')
const output_field = document.getElementById('output')
let length_selector = document.getElementById('output_length')
let summary_length = "normal"
let shouldStopStreaming = false

length_selector.addEventListener('change', (e)=> {
  summary_length = e.target.value
})

output_toggle.addEventListener('click', () => {
  generateSummary()
})


generateSummary();

// &#8856; stop
// &#8635; restart

function getTabId() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      resolve(tabs[0].id);
    })
  });
}

async function setToTabStorage(key, value) {
  const tabKey = `${await getTabId()}_${key}`;
  chrome.storage.local.set({[tabKey]: value});
}

async function getFromTabStorage(key) {
  const tabKey = `${await getTabId()}_${key}`;
  chrome.storage.local.get(tabKey, function(result) {
    const summary = result[tabKey];
    console.log('Summary retreived!');
    return summary;
  });
}

// Functions to generate summary
async function generateSummary() {
  shouldStopStreaming = true;

  let prompt = await injectScriptIntoHost(getPageContent);
  prompt = prompt.split(" ").slice(0, 1500).join(" ")+"..."; // 2867 is the max length of the prompt
  console.log(prompt)

  output_field.value = "";

  shouldStopStreaming = false;

  await askGPT(prompt, (message) => {
    output_field.value += message
  });
}

/**
 * @returns {string} pageText
 */
function getPageContent() {
  let pageText = '';
  const pageNodes = document.querySelectorAll('body > :not(header):not(footer):not(style):not(script)') 
  
  for (let i = 0; i < pageNodes.length; i++) {
    if (pageNodes[i].tagName.includes('SVG')) continue; // not anything with svg like <my-svg-tag>. unable to filter this with css selector
    pageText += pageNodes[i].innerText + '\n';
  }
  return pageText;
}

/**
 * @param {function} script 
 * @returns {Promise} injectionResults
 */
function injectScriptIntoHost(script) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: script,
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
  const controller = new AbortController();
  const signal = controller.signal;

  const response = await fetch('http://127.0.0.1:5000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'prompt': prompt,
      'length': summary_length,
      'stream': true,
    }),
    signal
  });

  if (!response.ok) {
    output_field.value = "Error connecting to server."
    throw new Error('Error fetching data');
  }

  const reader = response.body.getReader();
  let buffer = '', chunk = '';

  if (shouldStopStreaming) {
    controller.abort();
    buffer = '', chunk = '';
  }

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    chunk = new TextDecoder().decode(value);
    buffer += chunk;
    while (buffer.indexOf('}') !== -1) {
      let end = buffer.indexOf('}') + 1;
      let message = JSON.parse(buffer.substring(0, end))['message'];
      onChunk(message);
      buffer = buffer.substring(end);
    }
  }
  shouldStopStreaming = true;
}