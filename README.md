# Alex Renov & Voica Renov

Site vitrine en français pour une entreprise familiale de construction et rénovation dans le sud de la France. Le style associe des matières et couleurs provençales à une présentation sobre et haut de gamme.

## Pages

- `index.html` — site public, portfolio, avis et formulaire de demande de projet.
- `admin.html` — espace privé, protégé par connexion et règles d’accès Supabase. Il n’est pas lié dans la navigation publique; le fait que l’URL ne soit pas publiée ne constitue pas sa protection.
- `confidentialite.html` — modèle à compléter avec les informations exactes de l’entreprise avant d’activer le formulaire.

## Configuration Supabase

1. Créer un projet Supabase et exécuter une seule fois `supabase/schema.sql` dans le SQL Editor.
2. Dans Supabase Auth, créer un compte pour chaque administrateur autorisé. Récupérer l’UUID du compte et l’ajouter dans `public.admin_users` via le SQL Editor. Il n’y a pas d’inscription publique depuis le site.
3. Renseigner l’URL du projet, la clé publique/publishable et l’e-mail de contact dans `site-config.js`. Ajouter aussi `reviewProfileUrl` uniquement après création du vrai profil de l’entreprise. Ne jamais y mettre une clé `service_role` ou une autre clé secrète.
4. Configurer les URL d’authentification autorisées pour le domaine du site, puis ouvrir `admin.html` pour gérer les demandes, les photos et les avis.
5. Ajouter le vrai e-mail dans `site-config.js` pour proposer un contact direct. Sans Supabase, le formulaire peut préparer un brouillon d’e-mail si cette adresse est configurée; il ne conserve pas les demandes dans un tableau de bord.

Les demandes reçues ne sont visibles que par les comptes autorisés. La galerie est publique en lecture; seuls les administrateurs autorisés peuvent envoyer ou modifier son contenu. Les réponses aux clients ouvrent le logiciel e-mail de l’administrateur pour qu’il vérifie et envoie lui-même le message.

## Avant la mise en ligne

- Compléter `confidentialite.html` avec l’identité juridique, l’adresse, l’adresse e-mail, la durée de conservation et les informations d’hébergement exactes.
- Remplacer les valeurs vides dans `site-config.js`.
- Ajouter les coordonnées, la zone d’intervention précise, et les informations d’assurance/qualifications uniquement si elles sont confirmées.
- Ajouter au portfolio uniquement des photos de chantiers réellement effectués par l’équipe, avec l’accord du client.
- Publier uniquement des avis authentiques avec l’accord de leur auteur. Les étoiles et liens de source du site sont affichés à partir des avis renseignés par l’administrateur; aucune note moyenne n’est inventée.
- Les images d’ambiance sont générées pour le design du site. Elles ne sont pas utilisées comme preuves de réalisations.

Le site inclut actuellement 18 photos sélectionnées dans le dossier `Canva - Voica Renov/Portofoliu` : extérieurs, cuisines, salles de bain et pièces de vie. Les fichiers originaux restent intacts; les versions WebP optimisées et sans métadonnées sont stockées dans `assets/portfolio/`.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy.yml` publie le contenu du dépôt lorsque des changements sont envoyés sur la branche `main`. Dans GitHub, choisir **Settings → Pages → GitHub Actions** si Pages n’est pas activé automatiquement.

