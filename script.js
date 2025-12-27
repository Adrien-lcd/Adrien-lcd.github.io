/*
 * SCRIPT CLIENT - VERSION FINALISÉE (FORMAT UNIFIÉ)
 * Adapté pour tes données harmonisées :
 * - Dates reçues : "JJ/MM/AAAA" (ex: 01/01/2026) -> Converties en ISO interne
 * - Heures reçues : "HH:MM:SS" (ex: 10:00:00) -> Converties en HH:MM
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbxuHIOaJrAwoqyxixiONlDa3Xya7E7FwOJWe-MQiI9Z6XNiUWk4_XX10FYTF2bMcKI2vA/exec";

let allAppointments = [];
let allAvailabilities = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Éléments du DOM ---
    const dateSelect = document.getElementById('date-select');
    const timeSelect = document.getElementById('time-select');
    const availabilityDisplay = document.getElementById('availability-display');
    const bookingForm = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-btn');
    
    // Champs
    const durationSlider = document.getElementById('duration-slider');
    const durationValue = document.getElementById('duration-value');
    const clientName = document.getElementById('client-name');
    const clientEmail = document.getElementById('client-email');
    const clientMessage = document.getElementById('client-message');
    const toastContainer = document.getElementById('toast-container');

    // --- Listeners ---
    durationSlider.addEventListener('input', () => {
        durationValue.textContent = durationSlider.value;
        if (dateSelect.value) updateTimeSlots(dateSelect.value);
    });

    dateSelect.addEventListener('change', () => {
        const selectedDate = dateSelect.value;
        if (selectedDate) {
            renderDayDetails(selectedDate);
            updateTimeSlots(selectedDate);
        } else {
            availabilityDisplay.innerHTML = "";
            timeSelect.innerHTML = '<option value="">-- Choisissez une date --</option>';
        }
    });

    bookingForm.addEventListener('submit', handleFormSubmit);

    // --- Démarrage ---
    loadInitialData();


    // --- Logique Principale ---

    async function loadInitialData() {
        try {
            const response = await fetch(GAS_URL);
            const data = await response.json();

            if (data.status === "success") {
                
                // 1. Nettoyage des clés (minuscules)
                let rawRdv = normalizeKeys(data.rdv);
                let rawAvail = normalizeKeys(data.disponibilites);

                // 2. CONVERSION STANDARD (JJ/MM/AAAA -> AAAA-MM-JJ)
                // C'est ici que ton nouveau format est traité
                allAppointments = rawRdv.map(item => ({
                    ...item,
                    date: convertFrenchDateToISO(item.date),
                    time: cleanTime(item.time)
                }));
                
                allAvailabilities = rawAvail.map(item => ({
                    ...item,
                    date: convertFrenchDateToISO(item.date),
                    opentime: cleanTime(item.opentime),
                    closetime: cleanTime(item.closetime)
                }));
                
                console.log("Données standardisées :", allAvailabilities);

                populateDateSelect();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error(error);
            showToast("Erreur: " + error.message, "error");
            dateSelect.innerHTML = '<option>Erreur de connexion</option>';
        }
    }

    /**
     * Convertit "01/01/2026" en "2026-01-01"
     */
    function convertFrenchDateToISO(dateStr) {
        if (!dateStr) return "";
        dateStr = dateStr.toString().trim();

        // Si format JJ/MM/AAAA
        if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            // Sécurité : on vérifie qu'on a bien 3 morceaux
            if (day && month && year) {
                // On reformate en ISO standard pour le code JS
                return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
            }
        }
        
        // Si c'est déjà en ISO (ex: input utilisateur précédent), on coupe l'heure éventuelle
        if (dateStr.includes('-')) {
            return dateStr.split('T')[0];
        }

        return dateStr;
    }

    /**
     * Coupe les secondes : "10:00:00" -> "10:00"
     */
    function cleanTime(timeStr) {
        if (!timeStr) return "";
        const parts = timeStr.toString().split(':');
        if (parts.length >= 2) {
            return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
        }
        return timeStr;
    }


    // --- Fonctions d'Interface (UI) ---

    function populateDateSelect() {
        dateSelect.innerHTML = '<option value="">-- Sélectionner une date --</option>';
        
        // Tri chronologique
        allAvailabilities.sort((a, b) => a.date.localeCompare(b.date));

        // Filtre : Uniquement dates futures ou aujourd'hui
        const todayKey = new Date().toLocaleDateString('fr-CA'); // "AAAA-MM-JJ"

        let count = 0;
        
        // Utilisation d'un Set pour éviter les doublons si tu as mis 2 fois la même date dans le tableau
        const seenDates = new Set();

        allAvailabilities.forEach(dispo => {
            // On vérifie si la date est valide, future, et pas déjà ajoutée
            if (dispo.date >= todayKey && dispo.opentime && !seenDates.has(dispo.date)) {
                
                seenDates.add(dispo.date);
                
                // Affichage joli "Jeudi 1 janvier 2026"
                const dateObj = new Date(dispo.date);
                const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
                
                const option = document.createElement('option');
                option.value = dispo.date; // Value technique : "2026-01-01"
                option.textContent = `📅 ${label}`;
                dateSelect.appendChild(option);
                count++;
            }
        });

        if (count === 0) {
            const option = document.createElement('option');
            option.textContent = "Aucune disponibilité trouvée";
            dateSelect.appendChild(option);
        }
    }

    function renderDayDetails(dateKey) {
        const availability = allAvailabilities.find(a => a.date === dateKey);
        const dayRdvs = allAppointments.filter(rdv => rdv.date === dateKey);

        let html = `<div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px solid #ddd;">`;
        if (availability) {
            html += `<p><strong>Horaires d'ouverture :</strong> ${availability.opentime} - ${availability.closetime}</p>`;
        }

        if (dayRdvs.length > 0) {
            html += `<h5>⚠️ Créneaux réservés :</h5><ul style="padding-left: 20px;">`;
            
            dayRdvs.sort((a, b) => a.time.localeCompare(b.time));

            dayRdvs.forEach(rdv => {
                const [h, m] = rdv.time.split(':').map(Number);
                const endDate = new Date(0,0,0, h, m + parseInt(rdv.duration || 30));
                const endStr = endDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

                // Statut : on check tout ce qui n'est pas "cancelled" ou vide
                const status = (rdv.status || "").toLowerCase();
                const isBusy = status.includes('confirm') || status.includes('valid') || status.includes('pending'); 
                
                const icon = status.includes('confirm') ? '❌ Occupé' : '⏳ En attente';
                const nomClient = rdv.client_name || "Client";

                html += `<li>
                    <strong>${rdv.time} - ${endStr}</strong> : ${icon} 
                    <br><span style="font-size: 0.9em; color: #666;">${nomClient}</span>
                </li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p><em>Aucun rendez-vous pour le moment.</em></p>`;
        }
        html += `</div>`;
        availabilityDisplay.innerHTML = html;
    }

    function updateTimeSlots(dateKey) {
        timeSelect.innerHTML = "";
        const availability = allAvailabilities.find(a => a.date === dateKey);
        if (!availability) return;

        // On bloque les créneaux occupés
        const blockers = allAppointments.filter(rdv => {
            if (rdv.date !== dateKey) return false;
            const s = (rdv.status || "").toLowerCase();
            // On bloque tout sauf si c'est annulé
            return s.includes('confirm') || s.includes('valid') || s.includes('pending');
        });

        const openMinutes = timeToMinutes(availability.opentime);
        const closeMinutes = timeToMinutes(availability.closetime);
        const duration = parseInt(durationSlider.value);

        let count = 0;

        for (let time = openMinutes; time + duration <= closeMinutes; time += 15) {
            const slotStart = time;
            const slotEnd = time + duration;
            let isFree = true;

            for (let rdv of blockers) {
                const rdvStart = timeToMinutes(rdv.time);
                const rdvEnd = rdvStart + parseInt(rdv.duration || 30);

                // Formule de collision
                if (slotStart < rdvEnd && slotEnd > rdvStart) {
                    isFree = false;
                    break;
                }
            }

            if (isFree) {
                const option = document.createElement('option');
                option.value = minutesToTime(slotStart);
                option.textContent = minutesToTime(slotStart);
                timeSelect.appendChild(option);
                count++;
            }
        }

        if (count === 0) {
            const option = document.createElement('option');
            option.textContent = "Complet";
            timeSelect.appendChild(option);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const selectedDate = dateSelect.value; // C'est l'ISO (2026-01-01)
        const selectedTime = timeSelect.value;

        if (!selectedDate || !selectedTime || selectedTime.includes("Complet") || selectedTime.includes("Choisissez")) {
            showToast("Date ou heure invalide.", "error");
            return;
        }

        // --- CONVERSION INVERSE ---
        // Pour garder ton Sheet propre en JJ/MM/AAAA, on convertit avant d'envoyer
        const [y, m, d] = selectedDate.split('-');
        const dateForSheet = `${d}/${m}/${y}`; // Envoi au format 01/01/2026

        const newRdv = {
            date: dateForSheet, 
            time: selectedTime,
            duration: parseInt(durationSlider.value, 10),
            client_name: clientName.value,
            client_email: clientEmail.value,
            message: clientMessage.value
        };

        submitButton.disabled = true;
        submitButton.textContent = "Envoi...";

        try {
            const response = await fetch(GAS_URL, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(newRdv),
            });
            const result = await response.json();

            if (result.status === "success") {
                showToast("Envoyé ! Attente validation.", "success");
                bookingForm.reset();
                setTimeout(() => loadInitialData(), 1500);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            showToast("Erreur: " + error.message, "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Envoyer la demande";
        }
    }

    function normalizeKeys(list) {
        if (!list) return [];
        return list.map(item => {
            const newItem = {};
            for (const key in item) {
                let newKey = key.toLowerCase().trim();
                // Mapping des colonnes
                if (newKey.includes('date')) newKey = 'date';
                if (newKey.includes('time') || newKey.includes('heure')) newKey = 'time';
                if (newKey.includes('duration') || newKey.includes('durée')) newKey = 'duration';
                if (newKey.includes('open')) newKey = 'opentime';
                if (newKey.includes('close')) newKey = 'closetime';
                if (newKey.includes('stat')) newKey = 'status';
                if (newKey.includes('nom') || newKey.includes('client')) newKey = 'client_name';
                newItem[newKey] = item[key];
            }
            return newItem;
        });
    }

    function timeToMinutes(timeStr) {
        if(!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function showToast(msg, type) {
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = msg;
        toastContainer.appendChild(t);
        setTimeout(() => t.classList.add('show'), 100);
        setTimeout(() => {
            t.classList.remove('show'); t.remove();
        }, 3000);
    }
});
