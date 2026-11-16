# GetVerse

Application de bureau (Electron) pour projeter des versets bibliques pendant le culte.

## Lancer

```bash
npm install
npm start
```

Prérequis : Windows 10/11 et Node.js 18 ou plus.

## Créer l'installeur Windows

```bash
npm run dist
```

L'installeur `GetVerse Setup 1.0.0.exe` est créé à la racine du projet. Il installe l'application,
crée un raccourci sur le bureau et un raccourci « Désinstaller GetVerse » dans le menu Démarrer.

## Utilisation

| Touche | Action |
| --- | --- |
| `Tab` / `Entrée` | Valider le livre, puis le chapitre ; `Entrée` projette quand le verset est saisi |
| `↑` `↓` | Choisir parmi les suggestions de livres |
| `←` `→` | Verset précédent / suivant (après une projection) |
| `Page ↑` `Page ↓` | Précédent / suivant à tout moment |
| `Échap` | Écran vide |
| `F2` | Changer de version (Louis Segond 1910 / Bible du Semeur) |

Exemples de saisie : `gn 1 1`, `jean 3:16`, `jn 3:16-18`, puis `5` (verset 5 du même chapitre) ou `2:5`.

## Structure

- `src/` : application (processus principal, fenêtre de commande, fenêtre de projection)
- `data/lsg.json`, `data/bds.json` : textes bibliques au format `{ livre: { chapitre: [versets] } }`
- `scripts/build-assets.js` : génère les fonds d'écran et l'icône
- `scripts/build-bibles.js` : reconvertit les Bibles sources (nécessite `data/segond_1910.json` et `data/bds_fr.json`)
