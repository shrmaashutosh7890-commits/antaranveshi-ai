
import json
import os
import re
import urllib.request
import urllib.error

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openrouter/free"


def add_source_links(answer, message):
    """Add actual URL citations returned by OpenRouter to the answer."""
    annotations = message.get("annotations", [])
    sources = []
    seen_urls = set()

    for annotation in annotations:
        if annotation.get("type") != "url_citation":
            continue

        citation = annotation.get("url_citation", {})
        url = citation.get("url", "").strip()
        title = citation.get("title", "").strip()

        # Accept only real HTTP/HTTPS URLs.
        if not url.startswith(("https://", "http://")):
            continue

        if url in seen_urls:
            continue

        seen_urls.add(url)
        sources.append((title or url, url))

    if not sources:
        return answer

    # Avoid adding a second Sources section if one already exists.
    if re.search(r"(?im)^\s{0,3}#{1,3}\s*(sources|references|स्रोत)\b", answer):
        return answer

    source_lines = ["", "## Sources"]
    for title, url in sources:
        safe_title = title.replace("[", "(").replace("]", ")")
        source_lines.append(f"- [{safe_title}]({url})")

    return answer.rstrip() + "\n\n" + "\n".join(source_lines)


def generate_reply(question, mode="quick"):
    api_key = os.environ.get("OPENROUTER_API_KEY")

    if not api_key:
        return "API key missing. Set OPENROUTER_API_KEY in PowerShell."

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Antaranveshi AI, a careful research assistant. "
                    "Use web search for every question before answering. "
                    "Prefer official and primary sources. "
                    "Whenever search results provide URLs, cite them as "
                    "clickable Markdown links, for example "
                    "- [Official website](https://example.com). "
                    "Include a Sources section at the end when sources "
                    "were used. Give the actual source URL, not just its name. "
                    "Never invent URLs, facts, dates, or citations. "
                    "Only cite sources that were actually returned by search "
                    "and that support the relevant claims. "
                    "If live search could not be completed or no usable "
                    "sources were returned, say so clearly. "
                    "Do not pretend that a search was successful. "
                    "If sources disagree, explain the disagreement. "
                    "Reply in the user's language. "
"Use clean, natural, grammatically correct language. "
"If replying in Hindi, write Hindi words in Devanagari script "
"and keep English technical terms in English. "
"Do not mix Hindi and English letters inside the same word. "
"Do not create misspelled or hybrid words. "
"Use consistent language and script throughout the answer. "
"Use readable Markdown with headings, bold text, "
"and bullet points when helpful. "
"Whenever information is best compared or organized in rows "
"and columns, create a proper Markdown table with a header row "
"and a separator row. "
"Use tables for comparisons, feature lists, pros and cons, "
"and structured data when appropriate. "
"Do not write a table as plain text using spaces. "
"Keep paragraphs outside tables, and do not put an entire "
"answer inside a table. "
"Keep table cells concise and avoid unnecessary line breaks. "
"Use numbered lists for step-by-step instructions."
                )
            },
            {
                "role": "user",
                "content": question
            }
        ],
        "tools": [
            {
                "type": "openrouter:web_search",
                "parameters": {
                    "engine": "exa",
                    "max_results": 3,
                    "max_total_results": 3
                }
            }
        ],
        "usage": {
            "include": True
        }
    }

    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "Antaranveshi AI"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))

        choice = result["choices"][0]
        message = choice.get("message", {})
        answer = message.get("content")

        if isinstance(answer, list):
            # Handle providers that return content as a list of blocks.
            answer = "\n".join(
                block.get("text", "")
                for block in answer
                if isinstance(block, dict)
            )

        if not isinstance(answer, str) or not answer.strip():
            print("Empty AI response:", json.dumps(result, ensure_ascii=False))
            return "The AI returned no answer. Please try again."

        usage = result.get("usage", {})
        tool_usage = usage.get("server_tool_use", {})
        search_count = tool_usage.get("web_search_requests", 0)

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
            "Check the PowerShell terminal for details."
        )

    except (urllib.error.URLError, TimeoutError):
        return (
            "Could not reach the AI service. "
            "Check your internet connection."
        )

    except (KeyError, IndexError, ValueError, TypeError) as error:
        print("Unexpected API response:", repr(error))
        return "Unexpected response from the AI service. Check PowerShell."
