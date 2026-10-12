
const chatArea = document.getElementById("chatArea");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

const researchTools = [
    {
        key: "evidence",
        icon: "🔬",
        name: "Evidence Lab",
        description: "Check evidence and claims"
    },
    {
        key: "origin",
        icon: "📜",
        name: "Origin Tracker",
        description: "Trace origins and dates"
    },
    {
        key: "disagreement",
        icon: "⚖️",
        name: "Disagreement Map",
        description: "Compare different viewpoints"
    },
    {
        key: "citation",
        icon: "🔗",
        name: "Citation Trail",
        description: "Trace sources and references"
    }
];

function renderMarkdown(container, text) {
    container.replaceChildren();

    const lines = String(text || "").split("\n");
    let list = null;

    function closeList() {
        list = null;
    }

    function addInlineText(parent, text) {
        const pattern =
            /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*))/g;

        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            parent.appendChild(
                document.createTextNode(
                    text.slice(lastIndex, match.index)
                )
            );

            if (match[2] && match[3]) {
                try {
                    const url = new URL(match[3]);

                    if (
                        url.protocol === "http:" ||
                        url.protocol === "https:"
                    ) {
                        const link = document.createElement("a");
                        link.href = url.href;
                        link.textContent = match[2];
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        parent.appendChild(link);
                    } else {
                        parent.appendChild(
                            document.createTextNode(match[0])
                        );
                    }
                } catch {
                    parent.appendChild(
                        document.createTextNode(match[0])
                    );
                }
            } else if (match[4]) {
                const rawUrl = match[4].replace(/[.,!?;:]+$/, "");
                const trailing = match[4].slice(rawUrl.length);

                try {
                    const url = new URL(rawUrl);

                    if (
                        url.protocol === "http:" ||
                        url.protocol === "https:"
                    ) {
                        const link = document.createElement("a");
                        link.href = url.href;
                        link.textContent = rawUrl;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        parent.appendChild(link);
                    } else {
                        parent.appendChild(
                            document.createTextNode(rawUrl)
                        );
                    }
                } catch {
                    parent.appendChild(
                        document.createTextNode(rawUrl)
                    );
                }

                parent.appendChild(
                    document.createTextNode(trailing)
                );
            } else if (match[5]) {
                const bold = document.createElement("strong");
                bold.textContent = match[6];
                parent.appendChild(bold);
            } else if (match[7]) {
                const code = document.createElement("code");
                code.textContent = match[8];
                parent.appendChild(code);
            } else if (match[9]) {
                const italic = document.createElement("em");
                italic.textContent = match[10];
                parent.appendChild(italic);
            }

            lastIndex = pattern.lastIndex;
        }

        parent.appendChild(
            document.createTextNode(text.slice(lastIndex))
        );
    }

    for (const originalLine of lines) {
        const line = originalLine.trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
            closeList();
            continue;
        }

        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

        if (heading) {
            closeList();

            const level = heading[1].length;
            const element = document.createElement(`h${level}`);

            addInlineText(element, heading[2]);
            container.appendChild(element);
            continue;
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)$/);

        if (bullet) {
            if (!list || list.tagName !== "UL") {
                list = document.createElement("ul");
                container.appendChild(list);
            }

            const item = document.createElement("li");
            addInlineText(item, bullet[1]);
            list.appendChild(item);
            continue;
        }

        const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

        if (numbered) {
            if (!list || list.tagName !== "OL") {
                list = document.createElement("ol");
                container.appendChild(list);
            }

            const item = document.createElement("li");
            addInlineText(item, numbered[1]);
            list.appendChild(item);
            continue;
        }

        closeList();

        const paragraph = document.createElement("p");
        addInlineText(paragraph, trimmed);
        container.appendChild(paragraph);
    }
}

function addMessage(text, sender) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    if (sender === "assistant") {
        renderMarkdown(message, text);
    } else {
        message.textContent = text;
    }

    chatArea.appendChild(message);
    chatArea.scrollTop = chatArea.scrollHeight;

    return message;
}

function removeWelcome() {
    const welcome = chatArea.querySelector(".welcome");

    if (welcome) {
        welcome.remove();
    }
}

function addResearchButtons(container, originalQuestion) {
    const section = document.createElement("div");
    section.className = "research-tools";

    const heading = document.createElement("p");
    heading.className = "research-tools-heading";
    heading.textContent = "Explore this answer further";

    section.appendChild(heading);

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "research-tools-grid";

    researchTools.forEach((tool) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "research-tool-button";
        button.dataset.tool = tool.key;
        button.title = tool.description;

        const title = document.createElement("span");
        title.className = "research-tool-title";
        title.textContent = `${tool.icon} ${tool.name}`;

        const description = document.createElement("span");
        description.className = "research-tool-description";
        description.textContent = tool.description;

        button.appendChild(title);
        button.appendChild(description);

        button.addEventListener("click", () => {
            sendMessage(originalQuestion, tool.key);
        });

        buttonGroup.appendChild(button);
    });

    section.appendChild(buttonGroup);
    container.appendChild(section);

    chatArea.scrollTop = chatArea.scrollHeight;
}

async function sendMessage(text, researchTool = null) {
    const question = text.trim();

    if (!question) return;

    const selectedTool = researchTools.find(
        (tool) => tool.key === researchTool
    );

    removeWelcome();

    // Show which focused research mode was selected.
    const visibleQuestion = selectedTool
        ? `${selectedTool.icon} ${selectedTool.name}\nOriginal question: ${question}`
        : question;

    addMessage(visibleQuestion, "user");

    userInput.value = "";
    userInput.disabled = true;
    sendButton.disabled = true;

    document
        .querySelectorAll(".research-tool-button")
        .forEach((button) => {
            button.disabled = true;
        });

    const loadingMessage = addMessage(
        selectedTool
            ? `${selectedTool.name} is researching...`
            : "Thinking...",
        "assistant"
    );

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: question,
                mode: document.getElementById("researchMode").value,
                research_tool: researchTool
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Request failed.");
        }

        const answer = data.reply || "No answer received.";

        renderMarkdown(loadingMessage, answer);

        // Show research buttons only after a normal AI answer.
        if (!researchTool && answer !== "No answer received.") {
            addResearchButtons(loadingMessage, question);
        }

        console.log("AI reply:", data.reply);
        console.log("Research tool:", researchTool);

    } catch (error) {
        loadingMessage.textContent =
            "Could not connect to the Python server. Check that your backend is running.";

        loadingMessage.classList.add("error");
        console.error(error);

    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;

        document
            .querySelectorAll(".research-tool-button")
            .forEach((button) => {
                button.disabled = false;
            });

        userInput.focus();
    }
}

chatForm.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage(userInput.value);
});

function useSuggestion(question) {
    userInput.value = question;
    sendMessage(question);
}

userInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});

console.log("Antaranveshi AI frontend connected.");
