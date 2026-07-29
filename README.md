# Italie 2026 — Version 3.1

Cette version reprend les fonctions de la Version 2, mais le projet est maintenant organisé en plusieurs fichiers.

## Structure

- `index.html` : structure de l'application
- `css/style.css` : apparence
- `js/app.js` : Firebase, itinéraire, réservations, budget, listes et notes
- `images/` : images futures
- `assets/` : autres fichiers futurs

## Firebase

L'application lit l'itinéraire dans :

`Trips / italy-2026 / Days`

Elle synchronise les données partagées dans :

`italie / appState`

## Publication sur GitHub Pages

Tous les fichiers et dossiers doivent être téléversés dans le dépôt en conservant exactement cette structure.

Le fichier principal doit rester nommé `index.html`.

## Important

L'application doit être ouverte depuis GitHub Pages ou un serveur web. Certaines fonctions Firebase peuvent ne pas fonctionner correctement quand `index.html` est ouvert directement depuis le dossier Téléchargements avec une adresse commençant par `file:///`.

## Nouveauté 3.1

L’écran d’accueil contient maintenant un tableau de bord dynamique :

- prochaine journée de l’itinéraire;
- prochaine réservation;
- total des dépenses en dollars canadiens;
- progression des valises et des tâches.

Ces informations se mettent à jour à partir de Firebase.
