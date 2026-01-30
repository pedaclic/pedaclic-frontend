#!/bin/bash

# ============================================
# Script de Vérification - PedaClic Phase 1
# Vérifie que tous les fichiers nécessaires existent
# ============================================

echo "🔍 Vérification des fichiers Phase 1..."
echo "========================================"
echo ""

# Compteurs
TOTAL=0
FOUND=0
MISSING=0

# Fonction de vérification
check_file() {
    TOTAL=$((TOTAL + 1))
    if [ -f "$1" ]; then
        echo "✅ $1"
        FOUND=$((FOUND + 1))
    else
        echo "❌ $1 - MANQUANT"
        MISSING=$((MISSING + 1))
    fi
}

check_dir() {
    TOTAL=$((TOTAL + 1))
    if [ -d "$1" ]; then
        echo "✅ $1/"
        FOUND=$((FOUND + 1))
    else
        echo "❌ $1/ - MANQUANT"
        MISSING=$((MISSING + 1))
    fi
}

echo "📁 STRUCTURE DE DOSSIERS"
echo "------------------------"
check_dir "src"
check_dir "src/components"
check_dir "src/components/Layout"
check_dir "src/pages"
check_dir "src/hooks"
check_dir "src/services"
check_dir "src/types"
check_dir "src/utils"
echo ""

echo "📄 FICHIERS DE CONFIGURATION"
echo "----------------------------"
check_file "package.json"
check_file "tsconfig.json"
check_file "vite.config.ts"
check_file "index.html"
check_file "firebase.ts"
check_file ".env"
check_file "README.md"
echo ""

echo "🎨 COMPOSANTS LAYOUT"
echo "--------------------"
check_file "src/components/Layout/Header.tsx"
check_file "src/components/Layout/Header.css"
check_file "src/components/Layout/Footer.tsx"
check_file "src/components/Layout/Footer.css"
check_file "src/components/Layout/MainLayout.tsx"
check_file "src/components/Layout/MainLayout.css"
check_file "src/components/Layout/index.ts"
check_file "src/components/index.ts"
echo ""

echo "📄 PAGES"
echo "--------"
check_file "src/pages/Home.tsx"
check_file "src/pages/Home.css"
check_file "src/pages/Login.tsx"
check_file "src/pages/Register.tsx"
check_file "src/pages/Auth.css"
check_file "src/pages/Dashboard.tsx"
check_file "src/pages/Dashboard.css"
check_file "src/pages/NotFound.tsx"
check_file "src/pages/NotFound.css"
check_file "src/pages/index.ts"
echo ""

echo "🪝 HOOKS"
echo "--------"
check_file "src/hooks/useAuth.ts"
echo ""

echo "🔧 SERVICES"
echo "-----------"
check_file "src/services/auth.service.ts"
echo ""

echo "📝 TYPES"
echo "--------"
check_file "src/types/user.types.ts"
check_file "src/types/discipline.types.ts"
check_file "src/types/payment.types.ts"
check_file "src/types/index.ts"
echo ""

echo "⚙️ FICHIERS PRINCIPAUX"
echo "----------------------"
check_file "App.tsx"
check_file "main.tsx"
check_file "globals.css"
echo ""

echo "📚 DOCUMENTATION"
echo "----------------"
check_file "ARCHITECTURE.md"
check_file "CONVENTIONS.md"
echo ""

echo "========================================"
echo "📊 RÉSUMÉ"
echo "========================================"
echo "Total de fichiers vérifiés : $TOTAL"
echo "✅ Trouvés : $FOUND"
echo "❌ Manquants : $MISSING"
echo ""

if [ $MISSING -eq 0 ]; then
    echo "✨ PARFAIT ! Tous les fichiers sont présents."
    echo "🚀 Vous pouvez lancer le projet avec : npm run dev"
    exit 0
else
    echo "⚠️  ATTENTION : $MISSING fichier(s) manquant(s)"
    echo "Veuillez créer les fichiers manquants avant de continuer."
    exit 1
fi
