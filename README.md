PoeRank Overlay — Download
Version 1.0.0 · Windows 10/11 · Free
________________________________________
What It Does
PoeRank Overlay is a lightweight desktop companion for Path of Exile. Once configured, it displays a small, always-on-top overlay showing your live ladder rankings and XP/hr — pulled directly from poerank.com.
________________________________________
Installation
1.	Download the installer and run it.
2.	Windows SmartScreen may display a warning ("Windows protected your PC") because the application is not code-signed. Click More info, then Run anyway. This is expected for unsigned indie software.
3.	The installer will place the application in your Programs folder and create a desktop shortcut. No administrator privileges are required.
________________________________________
Getting Started:
•	The overlay opens in settings mode (if not then Ctrl+Shift+F12 or system tray, right click the PoE Rank icon, Open Settings). Select your league from the dropdown and type your exact character name (case-sensitive, as it appears on the ladder).
•	If the app cannot find your Client.txt file then you’ll be asked to enter it using the file picker tool. This file is located in your PoE install “PoE\logs” folder.
General Usage:
•	With the settings panel open (un-anchored mode) drag the overlay to where you want it to sit on your screen.
•	Click Anchor (or press Ctrl+Shift+F12) to lock it in place. The settings panel closes and the overlay becomes click-through (can’t interact with it).
•	Press Ctrl+Shift+F12 to un-anchor at any time, or right-click the PoeRank icon in the system tray (hidden icons, bottom-right taskbar) and choose Open Settings.
•	To exit the application, right-click the system tray PoE icon and select Quit PoeRank Overlay.
________________________________________
Overlay Display Fields
Overall: Character’s current position on the overall league ladder.
Cl/Asc: Class rank if un-ascended; Ascendancy rank once you've ascended
XP/hr: Amount of experience that your character is gaining per hour.
Countdown: (Not labeled) Time remaining until the next data refresh.
Rank color feedback: Rank numbers turn green when your position improves, red when it drops, and remain unchanged when the same.
Polling interval: The server dictates how often data is fetched (minimum 5 minutes, up to 20 minutes if the server is under heavy load). The countdown reflects the exact interval returned by the server.
________________________________________
Idle Detection & Smart Polling
The overlay monitors your Client.txt log file (written by Path of Exile while the game is running) to detect whether you are actively playing. If no new log activity is detected for 5 minutes, the countdown timer pauses — no unnecessary API calls are made while you are AFK, tabbed out for an extended period, or the game is closed.
The countdown resumes automatically when new log activity is detected.
Automatic discovery: The app attempts to locate Client.txt automatically by inspecting the running Path of Exile process and checking standard Steam and standalone install locations across all drives. If it cannot be found, a path entry field appears in the settings panel. The app will not anchor until a valid path is provided, as idle detection is required for responsible polling behavior.
If you installed Path of Exile to a non-standard location (e.g. a different drive or a custom folder name), use the Browse button or paste the path manually. The file is typically at: <YourInstallDrive>\...\Path of Exile\logs\Client.txt. If entered manually and the file location is incorrect, then a “File does not exist” message will appear.
________________________________________
Visibility Behavior
•	The overlay is intended to only be visible when Path of Exile is running and not minimized (with some delay, checks every 5 seconds).
•	In anchored mode, the overlay also hides when another application is in the foreground (windowed mode support) — it reappears automatically when you return to the game.
•	In settings (unanchored) mode, the overlay remains visible when you briefly alt-tab so you can continue configuring without losing your work.
________________________________________
Privacy & Transparency — What This App Does and Doesn't Do
You should know exactly what runs on your machine.
What PoeRank Overlay does:
•	Reads Client.txt — Path of Exile's own log file — solely to detect whether you are actively playing. No contents of this file are transmitted anywhere. It is read locally, on your machine, for the purpose of pausing the poll timer when you are idle.
•	Monitors the Path of Exile process — checks whether the game is running, minimized, or in the foreground, using a small PowerShell script. This is used exclusively to hide the overlay when the game is not visible.
•	Makes HTTP requests to PoeRank.com — sends your selected league name and character name as query parameters to retrieve your public ladder ranking. This is the same data visible to anyone on the Path of Exile website. No account credentials, email addresses, or personal information are transmitted.
•	Stores settings locally — your league, character name, overlay position, and Client.txt path are saved in a configuration file on your machine at %APPDATA%\PoeRank Overlay\config.json. This file never leaves your computer and is deleted if the overlay application is uninstalled.
•	Checks for updates — on launch, the app may contact poerank.com or GitHub to check if a newer version is available. If an update is found, it is downloaded and applied silently in the background.
What PoeRank Overlay does not do:
•	Does not read game memory or interact with the Path of Exile process in any way beyond checking whether the window is open.
•	Does not modify any game files.
•	Does not inject code into or hook the game in any way.
•	Does not collect analytics, usage data, or telemetry.
•	Does not transmit the contents of Client.txt or any other local file.
•	Does not require or request administrator privileges.
•	Does not add itself to Windows startup automatically.
•	Does not interact with the network for any purpose other than fetching your public rank data from poerank.com and checking for updates.
Path of Exile TOS: PoeRank Overlay does not interact with the game client, modify game files, read game memory, or automate any in-game actions. It is a passive display tool that reads only publicly available ladder data via a web API. It is my opinion that this application does not violate Grinding Gear Games' Terms of Service, but you use it at your own discretion.
________________________________________
Requirements
•	Windows 10 or Windows 11
•	Path of Exile (Steam or standalone)
•	An active internet connection (for rank data)
•	PowerShell 5.1 or later (included with all supported Windows versions)
________________________________________
Troubleshooting
The overlay doesn't appear: Make sure Path of Exile is running and not minimized. The overlay hides automatically when the game is not in the foreground.
The dropdown shows no leagues: The app could not reach poerank.com. Check your internet connection and try clicking the refresh icon, or use the Test button to trigger a manual fetch (10 second forced delay between attempts).
"NO CHAR" appears in the countdown box: Your character name was not found on the selected league's ladder. Verify that the name is spelled exactly as it appears in-game (case-sensitive) and that you have selected the correct league.
"NO CONN" appears in the countdown box: This happens when the application gets no response from the PoERank server. Either the server is down, your internet is down, or there’s a connectivity problem in between. Nothing to be done but wait.
I can’t anchor my overlay: Client.txt file pathing must be entered and you have not entered it. This happens with non-standard installation paths. Browse to the file manually using the file picker tool (in “PoE\logs” folder) — it will be remembered for all future sessions.
Windows SmartScreen blocked the installer. Click More info then Run anyway. The app is not code-signed (code signing certificates cost several hundred dollars per year), but the source code is publicly available on GitHub for review.
________________________________________
PoeRank Overlay is an unofficial fan tool and is not affiliated with or endorsed by Grinding Gear Games.
