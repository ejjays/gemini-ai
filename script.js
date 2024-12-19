let conversationFlowRules = '';
let aiRules = '';
let churchKnowledge = '';
let conversationHistory = [];
let linkFormatRules = '';

// Add this after your initial variable declarations
function getPhilippinesTime() {
    return new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour12: true,
        hour: "numeric",
        minute: "numeric",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// Load both files when the page loads
Promise.all([
  fetch('training-data/church-knowledge.txt').then(response => response.text()),
  fetch('training-data/ai-rules.txt').then(response => response.text()),
  fetch('training-data/link-format-rules.txt').then(response => response.text()),
  fetch('training-data/conversation-flow.txt').then(response => response.text())
])
.then(([knowledge, rules, linkRules, flowRules]) => {
  churchKnowledge = knowledge;
  aiRules = rules;
  linkFormatRules = linkRules;
  conversationFlowRules = flowRules;
})
.catch(error => console.error('Error loading files:', error));


const typingForm = document.querySelector(".typing-form");
const chatContainer = document.querySelector(".chat-list");
const suggestions = document.querySelectorAll(".suggestion");
const toggleThemeButton = document.querySelector("#theme-toggle-button");
const deleteChatButton = document.querySelector("#delete-chat-button");

// State variables
let userMessage = null;
let isResponseGenerating = false;

// API configuration
const API_KEY = "AIzaSyC0N559LhkMH1GqrvF1Pg7cpkMmaHMZgZg"; // API key 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

// Load theme and chat data from local storage on page load
const loadDataFromLocalstorage = () => {
  const savedChats = localStorage.getItem("saved-chats");
  const savedHistory = localStorage.getItem("conversation-history");
  const isLightMode = (localStorage.getItem("themeColor") === "light_mode");

  // Load conversation history if it exists
  if (savedHistory) {
    conversationHistory = JSON.parse(savedHistory);
  }

  // Restore saved chats or clear the chat container
  chatContainer.innerHTML = savedChats || '';
  document.body.classList.toggle("hide-header", savedChats);

  chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
}

// Create a new message element and return it
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
}

const processLinks = (text) => {
    // Look for the specific pattern and replace it with a clickable link
    return text.replace(/You can find [^\s]+ on Facebook: \[(.*?)\]\((https:\/\/www\.facebook\.com\/[^\)]+)\)/g, 
        (match, name, url) => {
            return `You can find <a href="${url}" class="person-link" target="_blank">${name}</a> on Facebook.`;
    });
}

// Show typing effect by displaying words one by one
const showTypingEffect = (text, textElement, incomingMessageDiv) => {
    const processedText = processLinks(text); // Process the text first
    const words = processedText.split(' ');
    let currentWordIndex = 0;

    const typingInterval = setInterval(() => {
        textElement.innerHTML += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex++];
        incomingMessageDiv.querySelector(".icon").classList.add("hide");

        if (currentWordIndex === words.length) {
            clearInterval(typingInterval);
            isResponseGenerating = false;
            incomingMessageDiv.querySelector(".icon").classList.remove("hide");
            localStorage.setItem("saved-chats", chatContainer.innerHTML);
        }
        chatContainer.scrollTo(0, chatContainer.scrollHeight);
    }, 75);
}

// Fetch response from the API based on user message
const generateAPIResponse = async (incomingMessageDiv) => {
  const textElement = incomingMessageDiv.querySelector(".text");
  
  // Create the conversation payload
  const messages = conversationHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  // Get current Philippines time
  const currentTime = getPhilippinesTime();

  // Add current context and rules
  const contextPrefix = `
  Current Date and Time in Philippines: ${currentTime}

  PRIORITY - CONVERSATION FLOW RULES:
  ${conversationFlowRules}
  
  SECONDARY RULES:
  ${aiRules}
  
  LINK FORMATTING RULES:
  ${linkFormatRules}
  
  CHURCH KNOWLEDGE BASE:
  ${churchKnowledge}
  
  Previous conversation context and current query: `;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [
          ...messages,
          { 
            role: "user", 
            parts: [{ text: contextPrefix + userMessage }] 
          }
        ]
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    const apiResponse = data.candidates[0].content.parts[0].text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Add AI response to conversation history
    conversationHistory.push({
      role: "assistant",
      content: apiResponse
    });
    
    localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));

    showTypingEffect(apiResponse, textElement, incomingMessageDiv);
  } catch (error) {
    isResponseGenerating = false;
    textElement.innerText = error.message;
    textElement.parentElement.closest(".message").classList.add("error");
  } finally {
    incomingMessageDiv.classList.remove("loading");
    
 const answerIndicator = incomingMessageDiv.querySelector('.answer-indicator');
    if (answerIndicator) {
      answerIndicator.textContent = "Answer";
    }
  }
}

// Show a loading animation while waiting for the API response
const showLoadingAnimation = () => {
  const html = `<div class="message-content">
                  <div class="header-row">
                    <img class="avatar" src="images/gemini.svg" alt="Gemini avatar">
                    <div class="answer-indicator">Thinking...</div>
                  </div>
                  <div class="message-container">
                    <p class="text"></p>
                    <div class="loading-indicator">
                      <div class="loading-bar"></div>
                      <div class="loading-bar"></div>
                      <div class="loading-bar"></div>
                    </div>
                  </div>
                </div>
                <span onClick="copyMessage(this)" class="icon material-symbols-rounded">content_copy</span>`;

  const incomingMessageDiv = createMessageElement(html, "incoming", "loading");
  chatContainer.appendChild(incomingMessageDiv);
  chatContainer.scrollTo(0, chatContainer.scrollHeight);
  generateAPIResponse(incomingMessageDiv);
}


// Copy message text to the clipboard
const copyMessage = (copyButton) => {
  const messageText = copyButton.parentElement.querySelector(".text").innerText;

  navigator.clipboard.writeText(messageText);
  copyButton.innerText = "done"; // Show confirmation icon
  setTimeout(() => copyButton.innerText = "content_copy", 1000); // Revert icon after 1 second
}

// Handle sending outgoing chat messages
const handleOutgoingChat = () => {
  userMessage = typingForm.querySelector(".typing-input").value.trim() || userMessage;
  if(!userMessage || isResponseGenerating) return;

  isResponseGenerating = true;

  // Add user message to conversation history
  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  // Keep the user message structure simple and inline
  const html = `<div class="message-content">
                <img class="avatar" src="images/user.jpg" alt="User avatar">
                <div class="message-container">
                  <p class="text"></p>
                </div>
              </div>`;

  const outgoingMessageDiv = createMessageElement(html, "outgoing");
  outgoingMessageDiv.querySelector(".text").innerText = userMessage;
  chatContainer.appendChild(outgoingMessageDiv);
  
  typingForm.reset(); // Clear input field
  
  inputWrapper.classList.remove("expanded");
  actionButtons.classList.remove("hide");
  
  document.body.classList.add("hide-header");
  chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
  setTimeout(showLoadingAnimation, 500); // Show loading animation after a delay
}

// Toggle between light and dark themes
toggleThemeButton.addEventListener("click", () => {
  const isLightMode = document.body.classList.toggle("light_mode");
  localStorage.setItem("themeColor", isLightMode ? "light_mode" : "dark_mode");
  toggleThemeButton.innerText = isLightMode ? "dark_mode" : "light_mode";
});

// Delete all chats from local storage when button is clicked
deleteChatButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all the chats?")) {
    localStorage.removeItem("saved-chats");
    localStorage.removeItem("conversation-history");
    conversationHistory = [];
    loadDataFromLocalstorage();
  }
});

// Set userMessage and handle outgoing chat when a suggestion is clicked
suggestions.forEach(suggestion => {
  suggestion.addEventListener("click", () => {
    userMessage = suggestion.querySelector(".text").innerText;
    handleOutgoingChat();
  });
});

// Prevent default form submission and handle outgoing chat
typingForm.addEventListener("submit", (e) => {
  e.preventDefault(); 
  handleOutgoingChat();
});

loadDataFromLocalstorage();

const inputWrapper = document.querySelector(".typing-form .input-wrapper");
const actionButtons = document.querySelector(".action-buttons");
const typingInput = document.querySelector(".typing-input");

typingInput.addEventListener("focus", () => {
  inputWrapper.classList.add("expanded");
  actionButtons.classList.add("hide");
});

typingInput.addEventListener("blur", () => {
  // Only collapse if there's no text
  if (typingInput.value.length === 0 && !isResponseGenerating) {
    inputWrapper.classList.remove("expanded");
    actionButtons.classList.remove("hide");
  }
});

typingInput.addEventListener("input", () => {
  // Keep expanded while typing
  if (typingInput.value.length > 0) {
    inputWrapper.classList.add("expanded");
    actionButtons.classList.add("hide");
  }
});

// Simplified event listeners
let windowHeight = window.innerHeight;
window.addEventListener('resize', () => {
  // Only collapse if the keyboard is actually hiding (height increasing)
  if (window.innerHeight > windowHeight) {
    if (typingInput.value.length === 0) {
      inputWrapper.classList.remove("expanded");
      actionButtons.classList.remove("hide");
    }
  }
  windowHeight = window.innerHeight;
});

// Only handle back button
window.addEventListener('popstate', (e) => {
  e.preventDefault();
  history.pushState(null, null, window.location.href);
});

// For Android back button
if (window.navigator.userAgent.match(/Android/i)) {
  document.addEventListener('backbutton', (e) => {
    e.preventDefault();
  }, false);
}