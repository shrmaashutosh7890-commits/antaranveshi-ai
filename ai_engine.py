
import json
import os
import re
import urllib.request
import urllib.error

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openrouter/free"


RESEARCH_TOOLS = {
    "evidence": {
        "name": "Evidence Lab",
        "instruction": (
            "Investigate important factual claims in the topic. "
            "Separate each major claim from its supporting evidence. "
            "Look for credible sources that support or contradict claims. "
            "Assess whether the evidence is strong, limited, disputed, "
            "or unverified. Explain the reasons for each assessment. "
            "Never label a claim verified without adequate evidence."
        ),
    },
    "origin": {
        "name": "Origin Tracker",
        "instruction": (
            "Investigate the earliest known references to the topic. "
            "Prioritize primary sources, original documents, manuscripts, "
            "dated editions, archival catalogues, and credible scholarship. "
            "Distinguish a text's estimated composition date from the date "
            "of a surviving manuscript or printed edition. "
            "Do not claim a source is the earliest ever unless the evidence "
            "supports that conclusion. State uncertainties clearly."
        ),
    },
    "disagreement": {
        "name": "Disagreement Map",
        "instruction": (
            "Compare credible scholarly interpretations of the topic. "
            "Identify the scholars or schools of thought, summarize their "
            "arguments, and explain the evidence each position uses. "
            "Distinguish established facts from interpretations and disputed "
            "claims. Represent opposing views fairly. Do not invent scholars, "
            "arguments, quotations, or disagreements."
        ),
    },
    "citation": {
        "name": "Citation Trail",
        "instruction": (
            "Trace the relationships between sources relevant to the topic. "
            "Investigate which sources cite, quote, reproduce, or depend on "
            "other sources when this can be established from available "
            "evidence. Distinguish direct source relationships from inference. "
            "Explain when several sources may repeat one original claim "
            "rather than provide independent confirmation. Never assert "
            "citation relationships that have not been verified."
        ),
    },
}


def add_source_links(answer, message):
    """Add actual HTTP/HTTPS citations returned by the API."""

    annotations = message.get("annotations", [])
    sources = []
    seen_urls = set()

    for annotation in annotations:
        if annotation.get("type") != "url_citation":
            continue

        citation = annotation.get("url_citation", {})
        url = citation.get("url", "").strip()
        title = citation.get("title", "").strip()

        if not url.startswith(("https://", "http://")):
            continue

        if url in seen_urls:
            continue

        seen_urls.add(url)
        sources.append((title or url, url))

    if not sources:
        return answer

    if re.search(
        r"(?im)^\s{0,3}#{1,3}\s*(sources|references|स्रोत)\b",
        answer,
    ):
        return answer

    source_lines = ["", "## Sources"]

    for title, url in sources:
        safe_title = title.replace("[", "(").replace("]", ")")
        source_lines.append(f"- [{safe_title}]({url})")

    return answer.rstrip() + "\n\n" + "\n".join(source_lines)


def generate_reply(question, mode="quick", research_tool=None):
    api_key = os.environ.get("OPENROUTER_API_KEY")

    if not api_key:
        return (
            "API key missing. Set OPENROUTER_API_KEY "
            "in your deployment environment."
        )

    mode = "deep" if mode == "deep" else "quick"

    if mode == "deep":
        max_results = 5
        max_total_results = 5
        research_instruction = (
            "Perform detailed research. Compare multiple credible sources, "
            "prioritize primary sources, verify important claims, "
            "and explain disagreements and uncertainties."
        )
    else:
        max_results = 3
        max_total_results = 3
        research_instruction = (
            "Perform focused research. Find the most relevant credible "
            "sources and answer clearly and concisely."
        )

    tool_instruction = ""

    if research_tool in RESEARCH_TOOLS:
        selected_tool = RESEARCH_TOOLS[research_tool]

        tool_instruction = (
            "\n\nSPECIALIZED RESEARCH MODE: "
            + selected_tool["name"]
            + "\n"
            + selected_tool["instruction"]
            + "\nFocus on the user's original question. "
            "Return a structured report with findings, supporting evidence, "
            "limitations, disagreements where relevant, and source links."
        )

    system_prompt = (
        "You are Antaranveshi AI, a careful research assistant. "
        + research_instruction
        + " Use web search for every question before answering. "
        "Prefer official, primary, and academically credible sources. "
        "Whenever search results provide URLs, cite them as clickable "
        "Markdown links. Include a Sources section when sources were used. "
        "Never invent URLs, facts, dates, quotations, or citations. "
        "Only cite sources actually returned by search that support "
        "the relevant claims. If live search could not be completed or "
        "no usable sources were returned, say so clearly. "
        "Do not pretend that a search was successful. "
        "If sources disagree, explain the disagreement. "
        "Reply in the user's language. "
        "Use clean, natural, grammatically correct language. "
        "If replying in Hindi, write Hindi words in Devanagari script "
        "and keep English technical terms in English. "
        "Do not mix Hindi and English letters inside the same word. "
        "Use consistent language and script throughout the answer. "
        "Use readable Markdown with headings, bold text, and bullet points. "
        "When comparisons or structured information are best presented "
        "in rows and columns, create a proper Markdown table with a header "
        "and separator row. Keep table cells concise. "
        "Use numbered lists for step-by-step instructions. "
        + tool_instruction
    )

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": question,
            },
        ],
        "tools": [
            {
                "type": "openrouter:web_search",
                "parameters": {
                    "engine": "exa",
                    "max_results": max_results,
                    "max_total_results": max_total_results,
                },
            }
        ],
        "usage": {
            "include": True,
        },
    }

    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://antaranveshi-ai.onrender.com",
            "X-Title": "Antaranveshi AI",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))

        choice = result["choices"][0]
        message = choice.get("message", {})
        answer = message.get("content")

        if isinstance(answer, list):
            answer = "\n".join(
                block.get("text", "")
                for block in answer
                if isinstance(block, dict)
            )

        if not isinstance(answer, str) or not answer.strip():
            print(
                "Empty AI response:",
                json.dumps(result, ensure_ascii=False),
            )
            return "The AI returned no answer. Please try again."

        usage = result.get("usage", {})
        tool_usage = usage.get("server_tool_use", {})
        search_count = tool_usage.get("web_search_requests", 0)

        print("Research mode:", mode)
        print("Specialized tool:", research_tool or "none")
        print("Finish reason:", choice.get("finish_reason"))
        print("Web searches reported:", search_count)
        print("Usage:", json.dumps(usage, ensure_ascii=False))

        if search_count:
            answer = add_source_links(answer, message)
        else:
            answer += (
                "\n\n**Live web search could not be confirmed for this "
                "response.** Please verify important claims independently."
            )

        return answer

    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        print("OpenRouter API error:", error.code, details)

        return (
            f"AI service error ({error.code}). "
            "Check the deployment logs for details."
        )

    except (urllib.error.URLError, TimeoutError):
        return (
            "Could not reach the AI service. "
            "Check your internet connection and try again."
        )

    except (KeyError, IndexError, ValueError, TypeError) as error:
        print("Unexpected API response:", repr(error))
        return (
            "Unexpected response from the AI service. "
            "Check the deployment logs."
        )
