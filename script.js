/*
 * SCRIPT CLIENT - VERSION COMPARATEUR FLEXIBLE
 * * SOLUTION :
 * Au lieu de normaliser les données à l'arrivée (ce qui peut échouer),
 * on utilise une fonction de comparaison intelligente (isSameDate) 
 * qui teste tous les formats possibles (5/11, 05/11, 2025-11-05) pour chaque ligne.
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbxuHIOaJrAwoqyxixiONlDa3Xya7E7FwOJWe-MQiI9Z6XNiUWk4_XX10FYTF2bMcKI2vA/exec";

let allAppointments = [];
let allAvailabilities = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM ---
    const dateSelect = document.getElementById('date-select');
    const timeSelect = document.getElementById('time-select');
    const availabilityDisplay = document.getElementById('availability-display');
    const bookingForm = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-btn');
    
    // Inputs
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
        // La value du select est au format ISO (AAAA-MM-JJ)
        const selectedDateISO = dateSelect.value;
        if (selectedDateISO) {
            renderDayDetails(selectedDateISO);
            updateTimeSlots(selectedDateISO);
        } else {
            availabilityDisplay.innerHTML = "";
            timeSelect.innerHTML = '<option value="">-- Choisissez une date --</option>';
        }
    });

    bookingForm.addEventListener('submit', handleFormSubmit);

    // --- Init ---
    loadInitialData();


    // --- Logique Principale ---

    async function loadInitialData() {
        try {
            const response = await fetch(GAS_URL);
            const data = await response.json();

            if (data.status === "success") {
                // On garde les données BRUTES, on ne touche à rien ici.
                // On nettoie juste les clés (minuscules) pour être sûr.
                allAppointments = normalizeKeys(data.rdv);
                allAvailabilities = normalizeKeys(data.disponibilites);
                
                console.log("Raw Availabilities:", allAvailabilities); // Debug console
                populateDateSelect();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error(error);
            showToast("Erreur chargement: " + error.message, "error");
            dateSelect.innerHTML = '<option>Erreur de connexion</option>';
        }
    }

    /*
     * C'EST ICI QUE LA MAGIE OPÈRE
     * Compare une date ISO (2025-11-05) avec une date du Sheet qui peut être n'importe quoi.
     */
    function isSameDate(isoDateString, sheetDateValue) {
        if (!sheetDateValue) return false;
        
        // 1. On parse la date cible (ISO) pour avoir les composants
        const [targetY, targetM, targetD] = isoDateString.split('-').map(String);
        
        // On prépare les formats possibles que l'on pourrait trouver dans le Sheet
        // Format AAAA-MM-JJ (avec zéros)
        const f1 = `${targetY}-${targetM}-${targetD}`;
        // Format JJ/MM/AAAA (avec zéros)
        const f2 = `${targetD}/${targetM}/${targetY}`;
        // Format J/M/AAAA (SANS zéros - ex: 5/11/2025) -> C'est souvent lui le coupable
        const f3 = `${parseInt(targetD)}/${parseInt(targetM)}/${targetY}`;
        // Format AAAA/MM/JJ
        const f4 = `${targetY}/${targetM}/${targetD}`;

        // On nettoie la valeur du sheet
        const val = sheetDateValue.trim();

        // On teste si la valeur du sheet correspond à l'un des formats
        return val.startsWith(f1) || val === f2 || val === f3 || val === f4;
    }

    function populateDateSelect() {
        dateSelect.innerHTML = '<option value="">-- Sélectionner une date --</option>';
        const today = new Date();
        today.setHours(0,0,0,0);
        let count = 0;

        for (let i = 0; i < 60; i++) { 
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            
            // Clé de référence unique pour notre logique (ISO)
            const isoKey = day.toLocaleDateString('fr-CA'); // "2025-11-05"
            const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(day);

            // Recherche avec le Comparateur Flexible
            const isOpen = allAvailabilities.find(a => isSameDate(isoKey, a.date) && a.opentime);

            if (isOpen) {
                const option = document.createElement('option');
                option.value = isoKey; // On stocke l'ISO comme valeur technique
                option.textContent = `📅 ${label}`;
                dateSelect.appendChild(option);
                count++;
            }
        }

        if (count === 0) {
            const option = document.createElement('option');
            option.textContent = "Aucune disponibilité trouvée";
            dateSelect.appendChild(option);
        }
    }

    function renderDayDetails(isoKey) {
        // Utilise isSameDate pour trouver la bonne ligne
        const availability = allAvailabilities.find(a => isSameDate(isoKey, a.date));
        
        // Utilise isSameDate pour trouver les RDV
        const dayRdvs = allAppointments.filter(rdv => isSameDate(isoKey, rdv.date));

        let html = `<div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px solid #ddd;">`;
        if (availability) {
            html += `<p><strong>Horaires d'ouverture :</strong> ${availability.opentime} - ${availability.closetime}</p>`;
        }

        if (dayRdvs.length > 0) {
            html += `<h5>⚠️ Rendez-vous déjà pris :</h5><ul style="padding-left: 20px;">`;
            dayRdvs.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

            dayRdvs.forEach(rdv => {
                if (!rdv.time) return;

                const [h, m] = rdv.time.split(':').map(Number);
                const endDate = new Date(0,0,0, h, m + parseInt(rdv.duration || 30));
                const endStr = endDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

                const status = (rdv.status || "").toLowerCase();
                const isConfirmed = status.includes('confirm') || status.includes('valid');
                
                const icon = isConfirmed ? '❌ Occupé' : '⏳ En attente';
                const nomClient = rdv.client_name || "Client";

                html += `<li>
                    <strong>${rdv.time} - ${endStr}</strong> : ${icon} 
                    <br><span style="font-size: 0.9em; color: #666;">${nomClient} (${rdv.duration} min)</span>
                </li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p><em>Aucun rendez-vous pour le moment.</em></p>`;
        }
        html += `</div>`;
        availabilityDisplay.innerHTML = html;
    }

    function updateTimeSlots(isoKey) {
        timeSelect.innerHTML = "";
        
        const availability = allAvailabilities.find(a => isSameDate(isoKey, a.date));
        if (!availability) return;

        const blockers = allAppointments.filter(rdv => {
            if (!isSameDate(isoKey, rdv.date)) return false;
            const s = (rdv.status || "").toLowerCase();
            return s.includes('confirm') || s.includes('valid');
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
                if (!rdv.time) continue;
                const rdvStart = timeToMinutes(rdv.time);
                const rdvEnd = rdvStart + parseInt(rdv.duration || 30);

                if (slotStart < rdvEnd && slotEnd > rdvStart) {
                    isFree = false;
                    break;
                }
            }

            if (isFree) {
                const option = document.createElement('option');
                option.value = minutesToTime(slotStart);
                option.textContent = `${minutesToTime(slotStart)}`;
                timeSelect.appendChild(option);
                count++;
            }
        }

        if (count === 0) {
            const option = document.createElement('option');
            option.textContent = "Complet pour cette durée";
            timeSelect.appendChild(option);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const selectedDate = dateSelect.value; // C'est l'ISO
        const selectedTime = timeSelect.value;

        if (!selectedDate || !selectedTime || selectedTime.includes("Complet") || selectedTime.includes("Choisissez")) {
            showToast("Date ou heure invalide.", "error");
            return;
        }

        // Note : On envoie la date au format ISO (2025-11-05)
        // Google Sheet la stockera, et si la colonne est formatée en Date, il l'affichera selon tes réglages.
        const newRdv = {
            date: selectedDate,
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
                showToast("RDV envoyé ! Attente validation.", "success");
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
                // Mapping manuel
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
