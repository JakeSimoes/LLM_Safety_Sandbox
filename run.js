import * as pdfjsLib from "./pdf.min.mjs"; // Used for PDF text extraction
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs'; // Required to use pdf.js

// Getting references to the image elements using their IDs
const shieldImage = document.getElementById('shield-selector');
const anonImage = document.getElementById('anon-selector');
const userInputBox = document.getElementById('user-input-box');
//const fileSelectionButton = document.getElementById('file-selector');
//const fileSelectorBox = document.getElementById('file-selector-box');
//const fileSelectorCloseButton = document.getElementById('file-selector-close');
const fileInput = document.getElementById('file-upload');
const chatArea = document.getElementById('chat-area');
const spacer = document.getElementById('spacer'); //

// Our local server
const endpoint = 'http://localhost:1234/v1/chat/completions';

// Our request object. Contains the info that will be sent along every request
// This includes the entire message history which is stored in messages
let request = {
    "model": "model-identifier",
    "temperature": 0.8,
    "max_tokens": -1,
    "messages": []
}

// Stores formed content objects for our attachments
let attachments = []

// Function to handle clicks on the shield image
function selectShield() {
    shieldImage.classList.remove('deselected'); // Remove .deselected from shield
    anonImage.classList.add('deselected'); // Add .deselected to anon
}

// Function to handle clicks on the anon image
function selectAnon() {
    anonImage.classList.remove('deselected'); // Remove .deselected from anon
    shieldImage.classList.add('deselected'); // Add .deselected to shield
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
 * Embeds file data into a OpenAI API compatible JSON object.
 * @param {string} fileBase64 - A base 64 string containing a pdf file.
 */
function newFileContent(fileBase64) {
    let newImageContent = {
        "type": "file",
        "file": {
            "file_data": fileBase64,
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

// Toggles the file selection window
//function fileSelectWindowToggle() {
//    if (fileSelectorBox.style.display == 'none') {
//        fileSelectorBox.style.display = 'flex';
//    } else {
//        fileSelectorBox.style.display = 'none';
//    }
//}

/**
 * Reads file data and parses it into the proper JSON objects. Results are added to the global attachments array.
 * @param {event} event - A file upload event.
 */
async function fileParsing(event) {
    const file = event.target.files[0];

    if (!file) return; // You never know

    try {
        const base64String = await convertFileToBase64(file);
    } catch (error) {
        console.error('Error converting to Base64:', error);
        return;
    }

    // Depending on whether or not we're reading a PDF or PNG, there are very different steps
    if (file.name.slice(-4) == '.pdf') {
        const textData = await extractPdfText(base64String);
        const newContent = newFileContent(textData);
        attachments.push(newContent);
    } else {
        const base64String = await convertFileToBase64(file);
        const newContent = newImageContent(base64String);
        attachments.push(newContent)
    }
}

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

// Honor Note: The below function is completely AI generated. It turns out PDF extraction is hard, really hard.
// Furthermore, there doesn't seem to be a simple library that just does it. In the interest of time and my sanity, the
// following function was generated by Gemini.

/**
 * Extracts text content from all pages of a PDF provided as a Base64 data URL.
 * Uses pdf.js library. Attempts to minimize extra whitespace using trimming and enhanced regex cleanup.
 * @param {string} pdfBase64 - The Base64 encoded data URL of the PDF file (e.g., "data:application/pdf;base64,...").
 * @returns {Promise<string>} A promise that resolves with the extracted text from all pages,
 *                            joined by double newlines. Returns an empty string if an error occurs,
 *                            the PDF has no pages, or no text is found.
 */
async function extractPdfText(pdfBase64) {
    // pdfjsLib.getDocument expects a URL, ArrayBuffer, TypedArray, or a Base64 data URL.
    const loadingTask = pdfjsLib.getDocument(pdfBase64);

    try {
        // Wait for the PDF document to be loaded
        const pdf = await loadingTask.promise;
        console.log('PDF loaded successfully.');

        const numPages = pdf.numPages;
        if (numPages === 0) {
            console.warn('PDF has no pages.');
            return ''; // No text to extract if there are no pages
        }

        const pagePromises = [];
        // Create an array of promises, one for each page's text extraction
        for (let i = 1; i <= numPages; i++) {
            pagePromises.push(
                // Get the page object (returns a promise)
                pdf.getPage(i).then(page => {
                    // Get the text content object (returns a promise)
                    return page.getTextContent().then(textContent => {
                        // 1. Map items to trimmed strings and filter empty ones
                        let pageText = textContent.items
                            .map(item => item.str.trim())
                            .filter(str => str.length > 0)
                            .join(' '); // Join with a single space initially

                        // --- Start of enhanced cleanup ---
                        // 2. Apply regex replacements for common spacing issues
                        pageText = pageText
                            // Replace multiple whitespace characters with a single space
                            .replace(/\s+/g, ' ')
                            // Remove space BEFORE common punctuation: .,;:)!?)]} and closing quotes/parentheses
                            .replace(/\s+([.,;:)!?\]\}\)"'])/g, '$1')
                            // Remove space AFTER opening brackets/quotes: ([{'"
                            .replace(/([(\[{'""])\s+/g, '$1')
                            // --- New/Modified Rules ---
                            // Remove space around hyphens when used between word characters (like starch - rich)
                            .replace(/(\w)\s+-\s+(\w)/g, '$1-$2') // Handles space on both sides
                            .replace(/(\w)\s+-/g, '$1-') // Handles space only before hyphen
                            .replace(/-\s+(\w)/g, '-$1') // Handles space only after hyphen
                            // --- End New/Modified Rules ---
                            .trim(); // Trim again in case regex leaves leading/trailing space
                        // --- End of enhanced cleanup ---

                        return pageText;
                    });
                })
            );
        }

        // Wait for all page text extraction promises to resolve
        const pageTexts = await Promise.all(pagePromises);

        // Join the text from all pages, separated by double newlines for readability
        // Also filter out any pages that might have ended up completely empty
        const fullText = pageTexts
            .filter(text => text.length > 0) // Remove empty pages
            .join('\n\n')
            .trim(); // Final trim for the whole text
        console.log(`Successfully extracted text from ${numPages} pages.`);
        return fullText;

    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        // Return an empty string in case of errors to prevent breaking the calling code
        return '';
    }
}

// Attach the functions to the 'click' event of each image
shieldImage.addEventListener('click', selectShield);
anonImage.addEventListener('click', selectAnon);
userInputBox.addEventListener('keydown', submitPrompt);
//fileSelectionButton.onclick = fileSelectWindowToggle;
//fileSelectorCloseButton.onclick = fileSelectWindowToggle;
fileInput.addEventListener('change', fileParsing);