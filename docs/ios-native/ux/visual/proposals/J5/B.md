# J5 proposal B (restructure): range menu inside the burn card, three data sets drawn

## Design
- Split the page into "Now" (Runway now, Cash today; never change) and a Burn card.
- The Burn card header carries a Menu button "Last 12 months" with a chevron (Linear-style filter pill). Choices: Last 30 days, Last 90 days, Last 12 months. The label always states the period shown.
- Each choice redraws the chart and a headline "Total [AMOUNT]" in the card: 30 days = 30 thin daily bars with a week axis (4 week ticks), 90 days = 13 weekly bars, 12 months = 12 monthly bars.
- PG-B-Finance gets three burn frames with different bar shapes and totals. Hidden frame replaces the total and callout with dots and flattens bars. Runway masked as "•• mo".
- Desk gets the same card and the same eye and chevron move as in A.

## Cost
Three chart data sets to draw and keep consistent, a new menu pill component, a new headline figure. SwiftUI: Menu + Picker binding + three queries; daily data adds backend load for a view few users change.
