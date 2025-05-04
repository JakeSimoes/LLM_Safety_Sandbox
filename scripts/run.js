// Yes yes, I know. Object Oriented Design rules over the Java kingdom.
// I forwent such classical design as I'm deficient in JavaScript acumen.
// Alas, I beg thee! Forgive this transient shortcoming!!!
//
//scribe.extractText(['https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'])
//	.then((res) => console.log(res))

import scribe from './scribe.js'; // Handles PDF OCR and extraction (Overjoyed I only found this after implementing extraction another way, why why why why).

//scribe.opt.usePDFText.ocr.main = true;
//scribe.opt.usePDFText.native.main = false;
        console.log(scribe.opt);

import * as pdfjsLib from "./pdf.min.mjs"; // Used for PDF text extraction
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs'; // Required to use pdf.js

// Getting references to the image elements using their IDs
const shieldImage = document.getElementById('shield-selector');
const anonImage = document.getElementById('anon-selector');
const userInputBox = document.getElementById('user-input-box');
const shieldPanel = document.getElementById('shield-panel');
const anonPanel = document.getElementById('anon-panel');
const fileInput = document.getElementById('file-upload');
const chatArea = document.getElementById('chat-area');
const spacer = document.getElementById('spacer'); //

// Getting references to our radio button elements...
const extractionRadio = document.getElementById('extraction-radio');
const filterRadio = document.getElementById('filter-off-radio');
const llmFilterRadio = document.getElementById('LLM-filter-segment-input');

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
 * @param {string} sender - 'user' or 'llm', sets what kind of bubble is generated.
 */
function displayMessage(text, sender) {
    // Create a new message paragraph and set its text content
    let message = document.createElement('div');
    message.innerHTML = text;

    // Set its type based on the sender
    if (sender == 'user') {
        message.classList.add('user-text-box');
    } else {
        message.classList.add('llm-text-box');
    }

    // Insert our new message before the spacer
    chatArea.insertBefore(message, spacer);
    chatArea.scrollTop = chatArea.scrollHeight;
}

/**
 * Handles messaging, from sending user input to displaying the response.
 * @param {event} event - A keyboard event
 */
function submitPrompt(event) {
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
        sendRequest();
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
 */
async function sendRequest() {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        return;
    }

    // Parsing our response data
    const responseData = await response.json();
    let llmResponse = responseData.choices[0].message.content;

    // Displaying and storing the response
    displayMessage(marked.parse(llmResponse), 'llm');
    request.messages.push(responseData.choices[0].message);

    // Enabling user input
    userInputBox.removeAttribute("disabled");
    userInputBox.setAttribute("placeholder", "Type Something...");
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

// Attach the functions to the 'click' event of each image
shieldImage.addEventListener('click', selectShield);
anonImage.addEventListener('click', selectAnon);
userInputBox.addEventListener('keydown', submitPrompt);
fileInput.addEventListener('change', fileParsing);