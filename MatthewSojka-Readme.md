# Matthew Sojka - Notes

This app is run by following the supplied instructions.  No other steps are necessary.

When navigating to the app in the browser, the Service Counter page is loaded immediately with the provided Opening Cash and Transactions.

As mentioned in the supplied instructions, only the count and explanation are permitted to be entered or modified by the user.

## Dependencies and Add-ons and Considerations
I had only added the Material UI depedency to utilize prebuilt components for tables, inputs, buttons, etc.

I did not make use of 3rd party state-management (eg Redux, Zustand) since it was not necessary for this exercise.

Since this only a single page/form, I did not use Tailwind CSS or a comparable package since the form was simple enough to use standard CSS.

All of the strings are hard-coded.  I would normally used string constants or an internationalization library for defining key-value string pairs.  This makes the code less brittle and error prone and allows easier string manipulation.

## Testing and Limitations
Besides manually testing in my browser, I also generated a number of Vitest unit tests.
These tests are fairly basic.  Many of them reference elements by strings rather than IDs.  This would normally be cleaned up and implemented better.
The strings make the tests more error-prone and require more maintenance, as well as making the tests very inefficient when compared to referencing elements by ids.

For proper end-to-end testing, I would have implemented something using Cypress or Playwright to handle browser testing.  These can usually do a better job of testing presentation and workflow.

## Time Spent
I spent approximately 2.5 hours on the exercise.  About 30-45 mins were used up front to understand the problem, sketch a layout for the form, and get a feel for the existing implementation for handling API requests, data formats, etc.

I utilized GitHub Copilot for the code generation.  I had made several iterations to construct the form, ensure correct layout, implement workflow behaviors, handle validation and error handling.  I spent the rest of my time cleaning up some of the code, creating utility methods for common logic, and adding comments to the code for clarification.





