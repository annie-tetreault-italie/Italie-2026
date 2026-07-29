# Italie 2026 — Version 3.3

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


## Nouveauté 3.2

Les cartes de l’itinéraire sont maintenant cliquables.

Chaque journée ouvre une fiche détaillée qui peut afficher automatiquement les champs Firebase suivants :

- `arrivalCity`
- `city`
- `transport` ou `train`
- `hotel` ou `accommodation`
- `activities`
- `restaurants`
- `schedule`
- `budget`
- `notes`
- `maps` ou `address`

Le bouton de carte ouvre Google Maps dans un nouvel onglet.


## Nouveauté 3.3

L’itinéraire est maintenant plus complet et plus facile à consulter :

- résumé automatique du nombre de journées, de villes et de fiches détaillées;
- recherche dans toutes les informations Firebase;
- filtre par ville;
- barre de navigation rapide par date;
- cartes de journée enrichies avec activités, restaurants, transport et hébergement;
- affichage propre des listes Firebase;
- boutons « journée précédente » et « journée suivante »;
- fiche détaillée mieux adaptée à l’iPhone.
