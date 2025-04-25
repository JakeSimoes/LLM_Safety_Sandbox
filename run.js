// Get references to the image elements using their IDs
const shieldImage = document.getElementById('shield-selector');
const anonImage = document.getElementById('anon-selector');
const userInputBox = document.getElementById('user-input-box');
const chatArea = document.getElementById('chat-area');
const spacer = document.getElementById('spacer');

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

 // Function to handle clicks on the shield image
function selectShield() {
    shieldImage.classList.remove('deselected'); // Remove .deselected from shield
    anonImage.classList.add('deselected');     // Add .deselected to anon
    console.log("Shield selected"); // Optional: for debugging
}

// Function to handle clicks on the anon image
function selectAnon() {
    anonImage.classList.remove('deselected');   // Remove .deselected from anon
    shieldImage.classList.add('deselected');   // Add .deselected to shield
    console.log("Anon selected"); // Optional: for debugging
}

// Displays user and llm messages
function displayMessage(text, sender) {
    // Create a new message paragraph and set its text content
    let message = document.createElement('p');
    message.textContent = text;

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

// Handles user input and passes it off to be sent
function submitPrompt(event) {
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
            "content": userPrompt
        }

        request.messages.push(newUserMessage);
        sendRequest();
    }
}

// Sends user requests to the server, then displays and stores the response
async function sendRequest() {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      body: JSON.stringify(request)
      }
    )

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    // Parsing our response data
    const responseData = await response.json();
    let llmResponse = responseData.choices[0].message.content;

    // Displaying and storing the response
    displayMessage(llmResponse, 'llm');
    request.messages.push(responseData.choices[0].message);

    // Enabling user input
    userInputBox.removeAttribute("disabled");
    userInputBox.setAttribute("placeholder", "Type Something...");
}

// Attach the functions to the 'click' event of each image
shieldImage.addEventListener('click', selectShield);
anonImage.addEventListener('click', selectAnon);
userInputBox.addEventListener('keydown', submitPrompt);
