---
description: Perform date-grounded internet search using Exa MCP and deliver clean, formatted results immediately
argument-hint: "<topic:string>"
---
Perform a real-time internet search for the following topic using the Exa MCP server (`web_search_exa` / `web_fetch_exa`):

Topic / Query: $ARGUMENTS

## Search Guidelines:
1. **Temporal Grounding:** Identify the current date/time before executing time-sensitive or date-relative searches (e.g. "today", "last 24 hours", "latest news").
2. **Provider:** Use `exa` (`web_search_exa` / `web_fetch_exa`) to retrieve clean markdown content.
3. **Direct Delivery:** Immediately format and output the complete answer (tabular format, structured summary, or deep-dive as requested) without pausing for unnecessary confirmations or workflow state transitions.
