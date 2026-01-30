#!/bin/bash

# ============================================
# Script de Démarrage Automatique - PedaClic
# Lance le projet avec vérifications
# ============================================

clear

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   🎓 PEDACLIC - DÉMARRAGE                     ║"
echo "║                  L'école en un clic                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 1️⃣ Vérification de Node.js
echo "🔍 Vérification de Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé !"
    echo "📥 Installez Node.js depuis : https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION détecté"
echo ""

# 2️⃣ Vérification de npm
echo "🔍 Vérification de npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé !"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm $NPM_VERSION détecté"
echo ""

# 3️⃣ Vérification du fichier .env
echo "🔍 Vérification de la configuration Firebase..."
if [ ! -f ".env" ]; then
    echo "⚠️  ATTENTION : Fichier .env manquant !"
    echo "📝 Création d'un fichier .env d'exemple..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Fichier .env créé à partir de .env.example"
        echo "⚠️  IMPORTANT : Modifiez le fichier .env avec vos vraies clés Firebase !"
    else
        echo "❌ .env.example introuvable. Veuillez créer .env manuellement."
    fi
    echo ""
fi

# 4️⃣ Vérification de node_modules
echo "🔍 Vérification des dépendances..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances"
        exit 1
    fi
    echo "✅ Dépendances installées avec succès"
else
    echo "✅ Dépendances déjà installées"
fi
echo ""

# 5️⃣ Vérification de la structure
echo "🔍 Vérification de la structure du projet..."
REQUIRED_DIRS=("src" "src/components" "src/pages" "src/hooks")
MISSING_DIRS=0

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "❌ Dossier manquant : $dir"
        MISSING_DIRS=$((MISSING_DIRS + 1))
    fi
done

if [ $MISSING_DIRS -gt 0 ]; then
    echo "❌ Structure de projet incomplète !"
    exit 1
fi
echo "✅ Structure du projet OK"
echo ""

# 6️⃣ Lancement du serveur
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   🚀 LANCEMENT DU SERVEUR                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 URL locale : http://localhost:5173"
echo "🌐 URL réseau : http://<votre-ip>:5173"
echo ""
echo "💡 Pour arrêter le serveur : Ctrl + C"
echo ""
echo "─────────────────────────────────────────────────────────────"
echo ""

# Lancer le serveur de développement
npm run dev
