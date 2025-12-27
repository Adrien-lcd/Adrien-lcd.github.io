/*
 * SCRIPT CLIENT (FRONTEND) - VERSION COMPLÈTE ET CORRIGÉE
 * Gère l'interaction avec la page HTML et l'API Google Sheets
 *
 * CORRECTIONS INCLUSES :
 * 1. [BUG FIX] Utilise .startsWith() pour la comparaison des dates (formatage Google Sheet vs JS)
 * 2. [AMÉLIORATION] N'affiche plus les jours "Fermé" dans la liste des prochaines ouvertures.
 * 3. [INTÉGRATION] URL de l'API Apps Script incluse.
 */

// ----------------------------------------------------------------
// URL DE L'API APPS SCRIPT INTÉGRÉE
const GAS_URL = "https://script.google.com/macros/s/AKfycbxuHIOaJrAwoqyxixiONlDa3Xya7E7FwOJWe-MQiI9Z6XNiUWk4_XX10FYTF2bMcKI2vA/exec";
// ----------------------------------------------------------------


// --- Variables globales pour stocker les données ---
let allAppointments = [];
let allAvailabilities = [];


// --- Sélection des éléments HTML (DOM) ---
// On attend que le HTML soit chargé
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Éléments principaux ---
    const datePicker = document.getElementById('date-picker');
    const availabilityDisplay = document.getElementById('availability-display');
    const bookingForm = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-btn');
    
    // --- Champs du formulaire ---
    const timeInput = document.getElementById('time-input');
    const durationSlider = document.getElementById('duration-slider');
    const durationValue = document.getElementById('duration-value');
    const clientName = document.getElementById('client-name');
    const clientEmail = document.getElementById('client-email');
    const clientMessage = document.getElementById('client-message');
    
    // --- Zone de notification ---
    const toastContainer = document.getElementById('toast-container');
    
    // --- ÉLÉMENT (Solution 2) ---
    const upcomingListDisplay = document.getElementById('upcoming-availability-list');


    // --- Écouteurs d'événements ---

    // 1. Mettre à jour la valeur du slider en temps réel
    durationSlider.addEventListener('input', () => {
        durationValue.textContent = durationSlider.value;
    });

    // 2. Charger les disponibilités quand la date change
    datePicker.addEventListener('change', handleDateChange); // C'est ici que l'erreur se produisait

    // 3. Envoyer le formulaire
    bookingForm.addEventListener('submit', handleFormSubmit);

    // --- On charge tout au démarrage ---
    loadInitialData();


    // --- Fonctions principales ---

    /**
     * Charge TOUTES les données 1 SEULE FOIS au chargement de la page.
     */
    async function loadInitialData() {
        upcomingListDisplay.innerHTML = "<p>Chargement des prochaines ouvertures...</p>";
        availabilityDisplay.innerHTML = "<p>Veuillez sélectionner une date ci-dessus.</p>";

        try {
            const response = await fetch(GAS_URL);
            if (!response.ok) {
                throw new Error("Erreur réseau (code: " + response.status + ")");
            }
            const data = await response.json();

            if (data.status === "success") {
                allAppointments = data.rdv;
                allAvailabilities = data.disponibilites;
                
                renderUpcomingList(14); // Affiche les 14 prochains jours
                
                if(datePicker.value) {
                     renderAvailability(datePicker.value);
                }

            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error("Erreur (loadInitialData):", error);
            const errorMsg = `<p style="color: red;">Impossible de charger les données: ${error.message}. Vérifiez l'URL de l'API et le format des onglets du Sheet.</p>`;
            upcomingListDisplay.innerHTML = errorMsg;
            availabilityDisplay.innerHTML = "";
        }
    }

    /**
     * AMÉLIORATION : N'affiche que les jours ouverts
     */
    function renderUpcomingList(daysToShow) {
        let html = "<h4>Prochaines ouvertures :</h4><ul>";
        let openDaysFound = 0; // Compteur pour savoir si on trouve des jours ouverts
        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        for (let i = 0; i < daysToShow; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            
            const dateStr = day.toISOString().split('T')[0]; // Format "AAAA-MM-JJ"
            
            const formattedDate = new Intl.DateTimeFormat('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'short'
            }).format(day);

            // [BUG FIX] Utilise .startsWith() au lieu de ===
            const availability = allAvailabilities.find(a => a.date.startsWith(dateStr));
            
            // [AMÉLIORATION] N'affiche la ligne que si le jour est ouvert
            if (availability && availability.openTime) {
                html += `<li><span class="summary-open">✅ ${formattedDate} : ${availability.openTime} - ${availability.closeTime}</span></li>`;
                openDaysFound++;
            }
            // (On ne fait rien si c'est fermé)
        }
        
        // Si aucun jour n'est ouvert, on affiche un message
        if (openDaysFound === 0) {
            html += "<li>Aucune date d'ouverture n'est prévue pour le moment.</li>";
        }

        html += "</ul>";
        upcomingListDisplay.innerHTML = html;
    }


    /**
     * !! VÉRIFIEZ QUE CETTE FONCTION EST BIEN PRÉSENTE !!
     * Appelé quand l'utilisateur change la date.
     * Ne fait plus de fetch, utilise les données globales.
     */
    function handleDateChange() {
        const selectedDate = datePicker.value;
        if (!selectedDate) {
            availabilityDisplay.innerHTML = "<p>Veuillez sélectionner une date ci-dessus.</p>";
            return;
        }
        
        // On appelle directement la fonction d'affichage
        renderAvailability(selectedDate);
    }


    /**
     * Affiche les infos de disponibilité et les RDV pour la date choisie
     */
    function renderAvailability(selectedDate) {
        // [BUG FIX] Utilise .startsWith() au lieu de ===
        const availability = allAvailabilities.find(a => a.date.startsWith(selectedDate));
        
        // [BUG FIX] Utilise .startsWith() au lieu de ===
        const appointmentsForDay = allAppointments.filter(rdv => rdv.date.startsWith(selectedDate));

        let html = "";

        if (availability && availability.openTime) {
            html += `<h3>Détails pour le ${selectedDate}</h3>`;
            html += `<p>✅ Ouvert de <strong>${availability.openTime}</strong> à <strong>${availability.closeTime}</strong></p>`;
            
            if (appointmentsForDay.length > 0) {
                html += "<h4>Rendez-vous déjà planifiés :</h4><ul>";
                
                appointmentsForDay.sort((a, b) => a.time.localeCompare(b.time));
                
                appointmentsForDay.forEach(rdv => {
                    const [hours, minutes] = rdv.time.split(':').map(Number);
                    const endDate = new Date(2000, 0, 1, hours, minutes + rdv.duration);
                    const endTime = endDate.toTimeString().substring(0, 5);

                    let statusClass = rdv.status === "confirmed" ? "status-confirmed" : "status-pending";

                    html += `<li class="${statusClass}"><strong>${rdv.time}</strong> à <strong>${endTime}</strong> (${rdv.duration} min) - <em>Statut: ${rdv.status}</em></li>`;
                });
                html += "</ul>";
            } else {
                html += "<p>Aucun rendez-vous pour l'instant.</p>";
            }

        } else {
            html += `<h3>Détails pour le ${selectedDate}</h3>`;
            html += "<p>❌ Le coiffeur n'est pas disponible ce jour-là.</p>";
        }

        availabilityDisplay.innerHTML = html;
    }


    /**
     * Appelé quand l'utilisateur soumet le formulaire
     */
    async function handleFormSubmit(event) {
        event.preventDefault(); 

        const newRdv = {
            date: datePicker.value,
            time: timeInput.value,
            duration: parseInt(durationSlider.value, 10),
            client_name: clientName.value,
            client_email: clientEmail.value, // Corrigé (utilisait clientName par erreur dans une version précédente)
            message: clientMessage.value
        };

        if (!newRdv.date || !newRdv.time) {
            showToast("Veuillez choisir une date et une heure.", "error");
            return;
        }

        if (checkConflict(newRdv, allAppointments)) {
            showToast("Conflit d'horaire ! L'heure que vous avez choisie est déjà prise.", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Envoi en cours...";

        try {
            const response = await fetch(GAS_URL, {
                method: "POST",
                mode: "cors", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newRdv),
            });
            const result = await response.json();

            if (result.status === "success") {
                showToast("Demande de RDV envoyée avec succès ! (Statut: En attente)", "success");
                bookingForm.reset(); 
                durationValue.textContent = "30"; 
                
                await loadInitialData(); // Recharge les données
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error("Erreur (handleFormSubmit):", error);
            showToast(`Erreur lors de l'envoi: ${error.message}`, "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Envoyer la demande";
        }
    }

    /**
     * Vérifie si le nouveau RDV entre en conflit avec des RDV existants
     */
    function checkConflict(newRdv, existingAppointments) {
        const newStart = parseDateTime(newRdv.date, newRdv.time);
        const newEnd = new Date(newStart.getTime() + newRdv.duration * 60000); 

        const appointmentsForDay = existingAppointments.filter(
            rdv => rdv.date.startsWith(newRdv.date) && rdv.status === "confirmed" 
        );

        for (const rdv of appointmentsForDay) {
            const existingStart = parseDateTime(rdv.date, rdv.time);
            const existingEnd = new Date(existingStart.getTime() + rdv.duration * 60000);

            const isOverlap = newStart < existingEnd && newEnd > existingStart;
            
            if (isOverlap) {
                return true; 
            }
        }
        return false; 
    }


    // --- Fonctions utilitaires ---

    function showToast(message, type = "success") {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'error' : 'success'}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function parseDateTime(dateStr, timeStr) {
        const cleanDateStr = dateStr.split('T')[0];
        const [year, month, day] = cleanDateStr.split('-');
        const [hours, minutes] = timeStr.split(':');
        return new Date(year, month - 1, day, hours, minutes);
    }
    
}); // Fin du 'DOMContentLoaded'







