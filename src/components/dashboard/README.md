# Dashboard card composition

Operational dashboard cards use three explicit layers:

1. `CardHeader` establishes the heading and optional counter or link.
2. `CardContent` contains data, `EmptyState`, or one or more `StatusPanel` blocks.
3. `CardFooter` anchors the primary action when the action applies to the whole card.

Use `EmptyState` instead of unframed placeholder text so an empty card still looks intentional. Use `StatusPanel` for success, warning, error, information, and neutral operational states. Text must wrap fully and actions must remain visible without relying on a fixed card height.
