# docs/

Every document is marked:

- **Living**: kept in step with the code. If it disagrees with the code, the document is wrong and is fixed.
- **Snapshot**: true of the moment in its title, and deliberately not updated since. If it disagrees with the code, the code moved, and the document is still a correct record of where it moved from. A snapshot is not edited: a record that gets edited stops being evidence.
- **Copy**: kept elsewhere and copied here byte for byte. It is changed at its source and recopied; `tools/check-angulo.mjs` pins its sha256.

`tools/check-angulo.mjs` reads this table: the documents marked Living are held to the interface standard (no emoji).

| document | state | about |
|---|---|---|
| [DECISIONS.md](DECISIONS.md) | Living | The decisions the plan left open, and every place the code departs from the plan, with the reason and the date. |
| [PLANO.md](PLANO.md) | Snapshot | The implementation plan as it was handed over on 2026-11-25 (pt-BR): the algorithm's formulas (§3), the interface (§4), the architecture (§5), the tests (§7) and the nine stages (§8). |
| [ANGULO.md](ANGULO.md) | Copy | The Ângulo interface standard (pt-BR), copied from simut-rx on 2026-11-25. |
