# Beta Feedback Notes

## Extended-Range Instrument Feedback

Labels: `beta-ux`, `beta-data`

Tester summary:

- FretTrack felt useful, thorough, and easy to learn after creating a few jobs and estimates.
- The workflow looks strong for protecting both the repair shop and the client.
- Before/after measurements were specifically called out as valuable.

Action items:

- Investigate whether job/status dropdown customization is missing, hidden by beta role, or unclear in the UI.
- Support multi-range and extended-range instruments such as 5-string bass, 6-string bass, 7-string guitar, 8-string guitar, baritone guitar, and other custom string counts.
- Review setup measurement labels so string count and instrument range affect the visible labels.
- Confirm print sheets and customer reports show instrument type and string count clearly.

Current implementation note:

- Job intake and detail editing now include a numeric String Count field with common suggestions and custom values.
- Instrument display now includes string count on overview, print sheet, and customer damage report.
- Setup/action labels use outer-string labels such as High G/Low B for extended basses and High E/Low B for 7+ string guitars.
- Job status customization remains a follow-up item; the dropdown exists, but shop-custom statuses are not implemented yet.
