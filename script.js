const chatArea = document.getElementById("chatArea");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

const researchTools = [
    { key: "evidence", icon: "🔬", name: "Evidence Lab", description: "Check evidence and claims" },
    { key: "origin", icon: "📜", name: "Origin Tracker", description: "Trace origins and dates" },
    { key: "disagreement", icon: "⚖️", name: "Disagreement Map", description: "Compare different viewpoints" },
    { key: "citation", icon: "🔗", name: "Citation Trail", description: "Trace sources and references" }
];

// Safely create formatted text without inserting raw HTML.
function addInlineText(parent, text) {
    const pattern =
        /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*))/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        parent.appendChild(
            document.createTextNode(text.slice(lastIndex, match.index))
        );

        if (match[2] && match[3]) {
            const link = makeSafeLink(match[3], match[2]);
            parent.appendChild(link || document.createTextNode(match[0]));
        } else if (match[4]) {
            const rawUrl = match[4].replace(/[.,!?;:]+$/, "");
            const trailing = match[4].slice(rawUrl.length);
            const link = makeSafeLink(rawUrl, rawUrl);

            parent.appendChild(link || document.createTextNode(rawUrl));
            parent.appendChild(document.createTextNode(trailing));
        } else if (match[5]) {
            const strong = document.createElement("strong");
            strong.textContent = match[6];
            parent.appendChild(strong);
        } else if (match[7]) {
            const code = document.createElement("code");
            code.textContent = match[8];
            parent.appendChild(code);
        } else if (match[9]) {
            const em = document.createElement("em");
            em.textContent = match[10];
            parent.appendChild(em);
        }

        lastIndex = pattern.lastIndex;
    }

    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
}

function makeSafeLink(href, label) {
    try {
        const url = new URL(href);

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            return null;
        }

        const link = document.createElement("a");
        link.href = url.href;
        link.textContent = label;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        return link;
    } catch {
        return null;
    }
}

function renderMarkdown(container, text) {
    // Preserve research buttons or other controls already attached to this message.
    const existingTools = container.querySelector(".research-tools");
    container.replaceChildren();

    const lines = String(text || "").split("\n");
    let list = null;
    let table = null;
    let tableBody = null;

    function closeList() {
        list = null;
    }

    function closeTable() {
        table = null;
        tableBody = null;
    }

    function parseTableRow(line) {
        return line.trim().replace(/^\|/, "").replace(/\|$/, "")
            .split("|").map(cell => cell.trim());
    }

    function isTableSeparator(line) {
        const cells = parseTableRow(line);
        return cells.length > 0 &&
            cells.every(cell => /^:?-{3,}:?$/.test(cell));
    }

    function appendTableRow(parent, cells, tagName) {
        const row = document.createElement("tr");

        cells.forEach(value => {
            const cell = document.createElement(tagName);
            addInlineText(cell, value);
            row.appendChild(cell);
        });

        parent.appendChild(row);
    }

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (!trimmed) {
            closeList();
            closeTable();
            continue;
        }

        // Markdown table: header, separator, then data rows.
        if (
            trimmed.includes("|") &&
            i + 1 < lines.length &&
            isTableSeparator(lines[i + 1])
        ) {
            closeList();
            closeTable();

            const headers = parseTableRow(trimmed);
            i++; // Skip separator row.

            table = document.createElement("table");
            table.className = "answer-table";

            const thead = document.createElement("thead");
            appendTableRow(thead, headers, "th");
            table.appendChild(thead);

            tableBody = document.createElement("tbody");
            table.appendChild(tableBody);
            container.appendChild(table);
            continue;
        }

        if (table && trimmed.includes("|")) {
            appendTableRow(tableBody, parseTableRow(trimmed), "td");
            continue;
        }

        closeTable();

        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

        if (heading) {
            closeList();

            const element = document.createElement(`h${heading[1].length}`);
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

    if (existingTools) {
        container.appendChild(existingTools);
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
    if (welcome) welcome.remove();
}

function addResearchButtons(container, originalQuestion) {
    // Prevent duplicate research button groups.
    if (container.querySelector(".research-tools")) return;

    const section = document.createElement("div");
    section.className = "research-tools";

    const heading = document.createElement("p");
    heading.className = "research-tools-heading";
    heading.textContent = "Explore this answer further";
    section.appendChild(heading);

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "research-tools-grid";

    researchTools.forEach(tool => {
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

        button.append(title, description);

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
    const question = String(text || "").trim();
    if (!question) return;

    const modeElement = document.getElementById("researchMode");
    const mode = modeElement ? modeElement.value : "quick";

    const selectedTool = researchTools.find(tool => tool.key === researchTool);

    removeWelcome();

    const visibleQuestion = selectedTool
        ? `${selectedTool.icon} ${selectedTool.name}\nOriginal question: ${question}`
        : question;

    addMessage(visibleQuestion, "user");

    userInput.value = "";
    userInput.disabled = true;
    sendButton.disabled = true;

    document.querySelectorAll(".research-tool-button").forEach(button => {
        button.disabled = true;
    });

    const loadingMessage = addMessage(
        selectedTool
            ? `${selectedTool.name} is researching...`
            : mode === "deep"
                ? "Deep Research is working. This may take a little longer..."
                : "Quick Research is working...",
        "assistant"
    );

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: question,
                mode,
                research_tool: researchTool
            })
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                `The server returned an unreadable response (HTTP ${response.status}).`
            );
        }

        if (!response.ok) {
            throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
        }

        const answer = data.reply || "No answer received.";
        renderMarkdown(loadingMessage, answer);

        if (!researchTool && answer !== "No answer received.") {
            addResearchButtons(loadingMessage, question);
        }

        console.log("Research mode:", mode);
        console.log("Research tool:", researchTool);
        console.log("AI reply:", answer);

    } catch (error) {
        loadingMessage.replaceChildren();

        const errorHeading = document.createElement("strong");
        errorHeading.textContent = "Research request failed";
        loadingMessage.appendChild(errorHeading);

        const errorText = document.createElement("p");
        errorText.textContent = error.message ||
            "An unexpected error occurred. Please try again.";
        loadingMessage.appendChild(errorText);

        loadingMessage.classList.add("error");
        console.error("Antaranveshi AI error:", error);

    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;

        document.querySelectorAll(".research-tool-button").forEach(button => {
            button.disabled = false;
        });

        userInput.focus();
    }
}

chatForm.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(userInput.value);
});

function useSuggestion(question) {
    userInput.value = question;
    sendMessage(question);
}

userInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});

console.log("Antaranveshi AI frontend connected.");
