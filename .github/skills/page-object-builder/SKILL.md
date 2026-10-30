---
name: page-object-builder
description: Derive Page Object classes (pages/*.ts) from the wording of the test case steps when no live app is available. Use after parsing and before generating specs.
---

# Page object builder

There is no live app to inspect, so locators are inferred from how the test case talks about the UI.
Be explicit that they are unverified.

## Steps

1. **Group by page.** Read all clear IR steps and preconditions; group them by screen ("login page",
   "products page", "checkout"). One class per page in `pages/<Name>Page.ts`. Reuse and extend existing
   classes instead of duplicating.
2. **Derive locators from the wording**, in this priority order:
   1. `getByRole(role, { name })`: "Click **Login**" -> button "Login"; "heading 'Cart'"; "link 'Home'"
   2. `getByLabel`: "Enter **username**" -> label "Username"
   3. `getByPlaceholder`, then `getByText` for visible messages
   4. `getByTestId` only if the test case names a test id
   Never CSS chains, nth-child, or XPath.
3. **Expose intent-named methods** (`login(user, pass)`, `addToCart(item)`, `search(query)`) and
   `Locator` properties for things assertions need (error message, badge, list).
4. **Header comment** on every class: `UNVERIFIED: locators inferred from the test case wording; no real page was inspected.`
5. If two steps imply different labels for the same element, keep one locator and note the doubt in a comment.
6. If a step names an element but you cannot tell its role or label (e.g. "the cart icon"), pick the most
   likely role, mark it with a `// guess:` comment, and mention it in your summary to the user.
