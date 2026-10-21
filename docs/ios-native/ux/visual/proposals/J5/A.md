# J5 proposal A (minimal): remove the range control, label the periods

Problem: the 30 days / 90 days / 12 months control only changes which bars are lit. Runway, Cash and the chart never change, so the control promises a filter it does not provide. Runway and Cash are point-in-time figures; a range cannot change them truthfully.

## Design
- Delete the segmented control from every frame of PG-B-Finance and from Desk.
- Label each figure with its period: tiles read "Runway now" and "Cash today"; the chart card header reads "Monthly burn, 12 months".
- The chart keeps 12 bars and the selected-month callout. The callout names the month ("Oct [AMOUNT]"). Unselected bars lighten to `#7E7C75` (about 3.6:1 on the `#252523` card) and a 1px baseline in `#3A3935` is added, so months can be read and compared.
- Hidden-amounts frame masks everything inferable: Runway reads "•• mo", the callout reads "Oct ••••", and all 12 bars are drawn at one equal height (selected bar still lighter), so burn shape cannot be read.
- Desk: the eye moves to the top-right of the top half, level with the "Finance" title. The back chevron moves to the top-left of the top half before the title; the chat half keeps only the Finance agent pill. Frame captions state that Hide amounts is remembered on this device and in every pose.
- Questions about a shorter window go to the Finance agent in the chat half ("Why did spend jump last month?" already shows the pattern).

## Cost
Two boards edited, no new data sets drawn. SwiftUI: one Swift Charts BarMark chart, one Text label per tile, one `@AppStorage` flag.
