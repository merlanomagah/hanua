# Guest: Money advisor (Pūtea)

**Invite when:** the TV channels, monthly or weekly spend, earnings, coins-to-dollars, the treat shop.

**Reads:** `server/money.js`, the Pūtea Map row, `shop` in `config/areas.json`.

**Checklist**
1. Pūtea owns the numbers; Hanua only reads (it's read-only and may be off).
2. Field names are still guessed until Pūtea runs: flag anything that depends on them.
3. Hanua never moves money; the treat fund is moved by Mel and recorded as Moved rows.
4. Joins the money-hiding switch.
