// Yes yes, I know. Object Oriented Design rules over the Java kingdom.
// I forwent such classical design as I'm deficient in JavaScript acumen.
// Alas, I beg thee! Forgive this transient shortcoming!!!

import scribe from './scribe.js'; // Handles PDF OCR and extraction (Overjoyed I only found this after implementing extraction another way, why why why why).
import * as pdfjsLib from "./pdf.min.mjs"; // Used for PDF text extraction
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs'; // Required to use pdf.js

// Getting references to key HTML elements using their IDs
const shieldImage = document.getElementById('shield-selector');
const anonImage = document.getElementById('anon-selector');
const userInputBox = document.getElementById('user-input-box');
const shieldPanel = document.getElementById('shield-panel');
const anonPanel = document.getElementById('anon-panel');
const fileInput = document.getElementById('file-upload');
const chatArea = document.getElementById('chat-area');
const spacer = document.getElementById('spacer');
const anonPanelEnd = document.getElementById('anon-panel-end');
const extractionRadio = document.getElementById('extraction-radio');
const filterRadio = document.getElementById('filter-off-radio');
const llmFilterRadio = document.getElementById('LLM-filter-off-radio');
const llmFilterPrompt = document.getElementById('llm-filter-prompt');
const phraseFilterContent = document.getElementById('phrase-filter-content');

// Our local server
const endpoint = 'http://localhost:1234/v1/chat/completions';

// Our request object. Contains the info that will be sent along every request
// This includes the entire message history which is stored in messages
let request = {
    "model": "model-identifier",
    "temperature": 0.1,
    "max_tokens": -1,
    "messages": []
}

// Stores formed content objects for our attachments
let attachments = []

// Function to handle clicks on the shield image
function selectShield() {
    shieldImage.classList.remove('deselected'); // Remove .deselected from shield
    anonImage.classList.add('deselected'); // Add .deselected to anon
    shieldPanel.style.display = "block";
    anonPanel.style.display = "none";
}

// Function to handle clicks on the anon image
function selectAnon() {
    anonImage.classList.remove('deselected'); // Remove .deselected from anon
    shieldImage.classList.add('deselected'); // Add .deselected to shield
    shieldPanel.style.display = "none";
    anonPanel.style.display = "block";
}

/**
 * Handles messaging, from sending user input to displaying the response.
 * @param {string} text - Plaintext user input.
 * @param {string} sender - 'user' or 'llm' or 'filtered', sets what kind of bubble is generated.
 */
function displayMessage(text, sender) {
    // Create a new message paragraph and set its text content
    let message = document.createElement('div');
    message.innerHTML = text;

    // Set its type based on the sender
    if (sender == 'user') {
        message.classList.add('user-text-box');
    } else if (sender == 'llm') {
        message.classList.add('llm-text-box');
    } else {
        message.classList.add('filtered-text-box');
    }

    // Insert our new message before the spacer
    chatArea.insertBefore(message, spacer);
    chatArea.scrollTop = chatArea.scrollHeight;
}

/**
 * Handles messaging, from sending user input to displaying the response.
 * @param {event} event - A keyboard event
 */
async function submitPrompt(event) {
    // Only triggered with a enter + ctrl combo!!!
    if (event.key == 'Enter' && event.ctrlKey) {
        // Display our message
        let userPrompt = userInputBox.value;
        displayMessage(userPrompt, 'user');
        // Resetting and blocking off user input
        userInputBox.value = null;
        userInputBox.setAttribute("disabled", "");
        userInputBox.setAttribute("placeholder", "Generating Response...");

        let newUserMessage = {
            "role": "user",
            "content": []
        }

        // Creating a new text JSON object
        newUserMessage.content.push(newTextContent(userPrompt));

        // Adding the attachment objects
        for (const fileContent of attachments) {
            newUserMessage.content.push(fileContent);
        }

        // Clearing the attachments array
        attachments = [];

        console.log(newUserMessage);

        // Building the final message and sending it
        request.messages.push(newUserMessage);
        const llmResponse = await sendRequest(request);

        // Checking for any secret exfiltration strings.
        secretStringExtractor(llmResponse.content);

        // If either of our enabled options takes issue with our content filtered = true
        let filtered = false;

        if (!llmFilterRadio.checked) {
            filtered = await isLLMFiltered(llmResponse.content);
        }

        if (!filterRadio.checked && !filtered) {
            filtered = isTextFiltered(llmResponse.content);
        }

        // Displaying and storing the response
        displayMessage(marked.parse(llmResponse.content), filtered ? 'filtered' : 'llm');
        request.messages.push(llmResponse);

        // Enabling user input
        userInputBox.removeAttribute("disabled");
        userInputBox.setAttribute("placeholder", "Type Something...");
    }
}

/**
 * Embeds text data into a OpenAI API compatible JSON object.
 * @param {string} text - Plaintext data.
 * @returns {json} A json object containing text content.
 */
function newTextContent(text) {
    let newTextContent = {
        "type": "text",
        "text": text
    }

    return newTextContent;
}

/**
 * Embeds image data into a OpenAI API compatible JSON object.
 * @param {string} imageBase64 - A base 64 string containing an image file.
 * @returns {json} A json object containing image content.
 */
function newImageContent(imageBase64) {
    let newImageContent = {
        "type": "image_url",
        "image_url": {
            "url": imageBase64,
        }
    }

    return newImageContent;
}

/**
 * Sends user requests to the server, then displays and stores the response
 * @param {json} newRequest - A properly formatted request object.
 * @returns {json} The content of the message returned by the server.
 */
async function sendRequest(newRequest) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRequest)
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        return;
    }

    // Parsing our response data
    const responseData = await response.json();
    let llmResponse = responseData.choices[0].message;
    return await llmResponse;
}

/**
 * Has an LLM check if the input text follows the LLMFilter system prompt guidelines.
 * The system prompt should ultimately ask the LLM to output safe or unsafe.
 * @param {string} text - The text to check against.
 * @returns {boolean} False if the LLM returns 'safe' true otherwise.
 */
async function isLLMFiltered(text) {
        // We can start with a clean slate every call
        let llmFilterRequest = {
            "model": "model-identifier",
            "temperature": 0.1,
            "max_tokens": -1,
            "messages": []
        }

        // We need to give our initial prompt as a system message
        let newSystemMessage = {
            "role": "system",
            "content": []
        }

        // Creating a new text JSON object
        newSystemMessage.content.push(newTextContent(llmFilterPrompt.value));

        // And the content to be filtered as a user message.
        let newUserMessage = {
            "role": "user",
            "content": []
        }

        // Creating a new text JSON object
        newUserMessage.content.push(newTextContent(text));

        llmFilterRequest.messages.push(newSystemMessage);
        llmFilterRequest.messages.push(newUserMessage);

        let llmResponse = await sendRequest(llmFilterRequest);
        console.log(llmResponse.content);
        return llmResponse.content.trim() !== 'safe';
}

// The below is AI generated because I'm short on time. I never formally learned JS so I've been fighting demons
// like promises and whatnot.

/**
 * Checks if the input text contains any of the phrases specified in the phraseFilterContent input box.
 * Phrases in the input box should be separated by commas.
 * @param {string} text - The text to check against the filter phrases.
 * @returns {boolean} True if any filter phrase is found in the text, false otherwise.
 */
function isTextFiltered(text) {
    // 1. Get the raw filter phrases from the input element
    const filterPhrasesRaw = phraseFilterContent.value;

    // 2. Handle empty or whitespace-only filter input
    if (!filterPhrasesRaw || !filterPhrasesRaw.trim()) {
        return false; // No phrases to filter by
    }

    // 3. Split the raw string into an array of phrases, trim whitespace from each, and filter out empty strings
    const filterPhrases = filterPhrasesRaw
        .split(',') // Split by comma
        .map(phrase => phrase.trim()) // Remove leading/trailing whitespace from each potential phrase
        .filter(phrase => phrase.length > 0); // Remove any empty strings resulting from extra commas (e.g., "a,,b")

    // 4. Check if the filter phrase list is empty after processing
    if (filterPhrases.length === 0) {
        return false;
    }

    // 5. Iterate through the cleaned filter phrases
    for (const phrase of filterPhrases) {
        // 6. Check if the current phrase exists within the input text.
        //    Using includes() for simple substring matching.
        //    Using toLowerCase() on both makes the check case-insensitive.
        if (text.toLowerCase().includes(phrase.toLowerCase())) {
            return true; // Found a match, no need to check further
        }
    }

    return false;
}

/**
 * Checks if the input text has any <secret> </secret> strings and sends their contents to the anon panel.
 * @param {string} text - The text to check for secret strings.
 */
function secretStringExtractor(text) {
    const re = new RegExp("<secret>.*</secret>");

    const matches = re.exec(text);

    if (matches) {
            for (const match of matches) {
    console.log(match);
        let message = document.createElement('div');
         message.classList.add('llm-text-box-data-panel');
        message.innerHTML = match;
        anonPanel.insertBefore(message, anonPanelEnd);
    }
    }



}

/**
 * Reads file data and parses it into the proper JSON objects. Results are added to the global attachments array.
 * @param {event} event - A file upload event.
 */
async function fileParsing(event) {
    const file = event.target.files[0];

    if (!file) return; // You never know

    // Depending on whether or not we're reading a PDF or PNG, there are very different steps
    if (file.name.slice(-4) == '.pdf') {
        // Need to tell Scribe.js not to supplement one method with the other
        if (extractionRadio.checked) {
            scribe.opt.usePDFText.ocr.main = false;
            scribe.opt.usePDFText.ocr.supp = false;
            scribe.opt.usePDFText.native.supp = true;
            scribe.opt.usePDFText.native.main = true;
        } else {
            scribe.opt.usePDFText.ocr.main = true;
            scribe.opt.usePDFText.ocr.supp = true;
            scribe.opt.usePDFText.native.supp = false;
            scribe.opt.usePDFText.native.main = false;
        }

        // Asking Scribed to analyze our PDF with either extraction or OCR
        const text = await scribe.extractText(event.target.files, ['eng'], 'txt', {skipRecPDFTextNative: extractionRadio.checked});

        console.log(text);
        // "The following content is a user supplied PDF file:" +
        const newContent = newTextContent("The document is:\n" + text);
        attachments.push(newContent);
    } else {
        let base64String = "";


        // The OpenAI API needs images in base64 format.
        try {
            base64String = await convertFileToBase64(file);
        } catch (error) {
            console.error('Error converting to Base64:', error);
            return;
        }

        const newContent = newImageContent(base64String);
        attachments.push(newContent)
    }

    fileInput.value = null;
}

/**
 * Reads file data and converts it into base64 code.
 * @param {File} file - A File object.
 * @returns {string} A base64 conversion of the file data.
 */
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            // Contains the Base64 encoded string
            resolve(reader.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };
        // Start reading the file as a data URL (Base64)
        reader.readAsDataURL(file);
    });
}

// debug function
function reset() {
    request = {
    "model": "model-identifier",
    "temperature": 0.8,
    "max_tokens": -1,
    "messages": []
    }

    attachments = [];

    chatArea.innerHTML = "<div id='spacer'></div>";
}

// Attaching functions to the 'click' event of key buttons.
shieldImage.addEventListener('click', selectShield);
anonImage.addEventListener('click', selectAnon);
userInputBox.addEventListener('keydown', submitPrompt);
fileInput.addEventListener('change', fileParsing);