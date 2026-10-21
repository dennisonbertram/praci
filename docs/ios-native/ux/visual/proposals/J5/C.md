# J5 proposal C (convention): Apple Stocks / Health chart pattern, range segmented control attached to the chart

Pattern: Apple Stocks and Apple Health put the range picker (1D 1W 1M 6M 1Y) directly under the chart it controls. The headline number above the chart follows the range; anything that is "as of now" sits outside the chart card.

## Design
- Runway and Cash stay at the top as "Runway now" and "Cash today", with no range control above them.
- The Burn card holds the chart, then a segmented control at its bottom edge (30 days / 90 days / 12 months), with "Monthly burn" headline showing the average per month for the range ("[AMOUNT] avg").
- Range changes the bar count (4 weekly, 3 monthly, 12 monthly) and the average. Scrubbing a bar shows its value in the callout.
- Three data frames are drawn in PG-B-Finance. Hidden frame masks the average, the callout, Runway, and flattens bars.
- Desk gets the same card; eye and chevron moves as in A.

## Cost
Same three data sets as B; control sits at the card bottom so the Duo top half (399pt tall) has to shed a row; SwiftUI Picker(.segmented) under a Chart with chartXSelection. Less new UI than B, more than A.
