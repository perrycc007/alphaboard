# Search External Skills

When the user types `/skill` followed by a query, search for matching skills using the SkillsMP API.

## Usage

- `/skill <query>` - Search for skills matching the query
- `/skill ai <query>` - Use AI-powered search for natural language queries

## API Endpoints

**Standard Search:**

```
GET https://skillsmp.com/api/v1/skills/search?q={query}
Authorization: Bearer [api-token]
```

**AI Search (for natural language queries):**

```
GET https://skillsmp.com/api/v1/skills/ai-search?q={query}
Authorization: Bearer [api-token]
```

## Behavior

1. **Detect command**: When user types `/skill` or `/skill ai`, extract the query text
2. **Choose endpoint**:
   - Use `/skills/search` for `/skill <query>`
   - Use `/skills/ai-search` for `/skill ai <query>`
3. **Make API call**: Use the appropriate endpoint with URL-encoded query
4. **Display results**: Show the returned skills in a clear, formatted way with:
   - Skill name/title
   - Description
   - Category/tags
   - Relevance score (if available)
   - Any usage instructions or examples from the API response
5. **Create command file**: If skills are found:
   - **If single result**: Display the skill details and **ask for confirmation** before creating the command file
   - **If multiple results**: Present all options, ask user which skill to add, then **ask for confirmation** before creating the command file
   - **Confirmation required**: Always ask "Would you like me to create a command file for this skill?" and wait for user approval (yes/no/confirm)
   - **Only create after confirmation**: Do not create the file until user explicitly confirms
   - **Command file format** (after confirmation):
     - Use the skill's name as the filename (sanitized: lowercase, hyphens for spaces)
     - Include the skill's description/instructions as the command content
     - Preserve any code examples, usage patterns, or guidelines from the API response
6. **Handle errors**: If API call fails, show error message and suggest alternatives

## Example Queries

- `/skill SEO` → Search for SEO-related skills
- `/skill ai How to create a web scraper` → AI search for web scraping skills
- `/skill database optimization` → Search for database skills

## Response Format

Present results as:

- Skill name/title
- Description (if available)
- Category/tags (if available)
- Relevance score (if available)
- Link or identifier (if available)

If no results found, suggest:

- Try different keywords
- Use `/skill ai` for natural language queries
- Check spelling

## Creating Command Files

When a skill is found and selected:

1. **Extract skill information** from API response:

   - Name/title
   - Description/instructions
   - Usage examples
   - Code snippets or templates
   - Any configuration or setup requirements

2. **Create command file** at `.cursor/commands/{sanitized-skill-name}.md`:

   - Sanitize filename: convert to lowercase, replace spaces with hyphens, remove special chars
   - Use skill name as the main heading
   - Include full description and instructions
   - Preserve formatting, code blocks, and examples from API response
   - Add a note at the top indicating it was imported from SkillsMP

3. **Request confirmation**: Before creating the file, ask:

   - "Found skill: [skill name]"
   - Show brief description
   - "Would you like me to create a command file for this skill? (yes/no)"
   - Wait for explicit user confirmation

4. **Create after confirmation**: Only after user confirms (yes/confirm/y), create the file

5. **Confirm creation**: After creating the file, inform the user:
   - File path created
   - How to use the new command (usually `/command-name`)
   - Brief summary of what the skill does

**Example flow**:

```
User: /skill SEO
AI: Found skill "SEO Optimizer" - [description]
AI: Would you like me to create a command file for this skill? (yes/no)
User: yes
AI: Created .cursor/commands/seo-optimizer.md
AI: You can now use this skill via the command system.
```
