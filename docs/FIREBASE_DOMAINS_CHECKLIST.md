# Checklist : Domaines autorisés Firebase

## Erreur « Fetch API cannot load... due to access control checks »

Cette erreur survient souvent lorsque le domaine de l'application **n'est pas autorisé** dans la console Firebase.

### Étapes à suivre

1. **Ouvrir la console Firebase**  
   https://console.firebase.google.com/project/pedaclic/overview

2. **Aller dans Paramètres du projet**  
   Icône engrenage → Paramètres du projet

3. **Onglet « Général »**  
   Descendre jusqu'à la section **« Domaines autorisés »**

4. **Vérifier / ajouter les domaines**  
   Les domaines suivants doivent être présents :
   - `pedaclic.sn`
   - `www.pedaclic.sn`
   - `pedaclic.web.app` (hébergement Firebase)
   - `localhost` (pour le développement)

5. **Cliquer sur « Ajouter un domaine »** si nécessaire  
   Saisir `pedaclic.sn` puis `www.pedaclic.sn`

6. **Sauvegarder** et attendre quelques minutes pour la propagation

### Vérification

Après modification, vider le cache du navigateur (Ctrl+Shift+R ou Cmd+Shift+R) et recharger l'application.
