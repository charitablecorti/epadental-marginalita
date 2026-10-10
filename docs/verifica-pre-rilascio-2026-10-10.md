# Verifica pre-rilascio 10/10/2026

Archivio GitHub privato: quattro CSV presenti.

Su 2.014 righe candidate, 572 non hanno prezzo unitario netto e 9 hanno prezzo negativo. Nessuna riga ha costo per prestazione verificato o dimensione confezione verificata. Il prezzo di confezione non deve essere scambiato per il consumo clinico.

Il lettore filtra prezzi non positivi, limita la ricerca a EUR e usa cache con timeout. Il motore richiede ancora test runtime reali, verifica delle corrispondenze prodotto e validazione dei consumi. Il token Netlify non e' verificabile dal connettore GitHub.

NON unire il branch in main, NON effettuare build fino al superamento dei test.
