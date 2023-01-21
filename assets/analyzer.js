var interval
var files = 0
var done = 0
var error = 0
var selected = null
var rpMode = false

var filetypes = {}
var selectors = {
	a: 0,
	e: 0,
	p: 0,
	r: 0,
	s: 0
}
var packFiles = []
var commands = {}
var cmdsBehindExecute = {}
var comments = 0
var empty = 0

async function processEntries(entries, path) {
	for await (const entry of entries) {
		const filePath = path + "/" + entry.name
		if (entry.kind == "directory") {
			processEntries(entry, filePath)
			continue
		}

		const ext = entry.name.split(".").pop()
		if (
			ext == "mcmeta" || ext == "json" ||
			(!rpMode && (ext == "mcfunction" || ext == "nbt")) ||
			(rpMode && (ext == "png" || ext == "icns" || ext == "txt" || ext == "ogg" || ext == "fsh" || ext == "vsh"))
		) {
			if (!filetypes[ext]) filetypes[ext] = 1
			else filetypes[ext]++
		} else continue

		if (ext == "mcfunction" || ext == "mcmeta") {
			files++

			function processFile(result) {
				done++

				if (!rpMode && ext == "mcfunction") {
					const lines = result.split("\n")
					for (let line of lines) {
						line = line.trim()
						if (line.startsWith("#")) comments++
						if (line == "") empty++
						if (line.startsWith("#") || line == "") continue
						const splitted = line.split(" ")

						const cmd = splitted[0]
						if (!commands[cmd]) commands[cmd] = 1
						else commands[cmd]++

						if (cmd == "execute") {
							line.match(/ run [a-z_:]{2,}/g)?.forEach(match => {
								const cmdBehind = match.replace(" run ", "")
								if (!cmdsBehindExecute[cmdBehind]) cmdsBehindExecute[cmdBehind] = 1
								else cmdsBehindExecute[cmdBehind]++
								if (!commands[cmdBehind]) commands[cmdBehind] = 1
								else commands[cmdBehind]++
							})
						}

						splitted.forEach(arg => {
							if (arg.startsWith("@")) {
								arg = arg.slice(1)
								if (arg.startsWith("a")) selectors.a++
								else if (arg.startsWith("e")) selectors.e++
								else if (arg.startsWith("p")) selectors.p++
								else if (arg.startsWith("r")) selectors.r++
								else if (arg.startsWith("s")) selectors.s++
							}
						})
					}
				} else if (ext == "mcmeta") {
					if (entry.name == "pack.mcmeta") {
						try {
							packFiles.push(JSON.parse(result))
						} catch (e) {
							console.warn("Could not parse pack.mcmeta: " + filePath, e)
							error++
						}
					}
				}
			}

			if (entry.content) processFile(entry.content)
			else {
				const reader = new FileReader()
				reader.readAsText(entry)

				reader.onload = function() {
					processFile(reader.result)
				}
				reader.onerror = function(e) {
					console.warn("Could not read file: " + filePath, e)
					error++
				}
			}
		}
	}
}

async function mainScan() {
	if (interval) clearInterval(interval)
	document.getElementById("result").innerHTML = ""

	files = 0
	done = 0
	error = 0
	rpMode = document.getElementById("radiorp").checked

	filetypes = {}
	selectors = {
		a: 0,
		e: 0,
		p: 0,
		r: 0,
		s: 0
	}
	packFiles = []
	commands = {}
	cmdsBehindExecute = {}
	comments = 0
	empty = 0

	processEntries(selected, selected.name)

	interval = setInterval(() => {
		document.getElementById("progress").innerText = Math.round(done / files * 100) + "% scanned" + (error > 0 ? " - " + error + " errors" : "")
		if (done + error == files) {
			clearInterval(interval)
			if (error == 0) document.getElementById("progress").innerText = ""
			if (Object.values(filetypes).reduce((a, b) => a + b) == 0) document.getElementById("progress").innerHTML = "No " + (rpMode ? "resource" : "data") + "pack files found!"

			var html =
				(packFiles.length > 0 ? "<strong>" + (rpMode ? "Resource" : "Data") + "pack" + (packFiles.length == 1 ? "" : "s") + " found:</strong><br>" +
				packFiles.map(pack => "<span class='indented'>" + pack.pack.description.replace(/§[a-f0-9]/g, "") +
					(window.versions.some(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format) ?
						" (Supported versions: " +
						(window.versions.findLast(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format)?.name || "?") + "<strong>-</strong>" +
						(window.versions.find(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format)?.name || "?") +
						")</span>"
					: "")
				).join("<br>") + "<br>"
				: "") +
				(!rpMode && Object.keys(commands).length > 0 ?
					"<strong>Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)) + "</strong><br>" +
					"<span class='indented'>Unique commands: " + localize(Object.keys(commands).length) + "</span><br>" +
					(comments > 0 ? "<span class='indented'>Comments: " + localize(comments) + "</span><br>" : "")
				: "") +
				(empty > 0 ? "<span class='indented'>Empty lines: " + localize(empty) + "</span><br>" : "") +
				"<strong>Pack file types found:</strong><br>" +
				Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).map(type => "<span class='indented'>." + type + ": " + localize(filetypes[type]) + "</span><br>").join("") +
				(selectors.a + selectors.e + selectors.p + selectors.r + selectors.s != 0 ? "<strong>Selectors used:</strong><br>" : "") +
				(selectors.a > 0 ? "<span class='indented'>@a: " + localize(selectors.a) + "</span><br>" : "") +
				(selectors.e > 0 ? "<span class='indented'>@e: " + localize(selectors.e) + "</span><br>" : "") +
				(selectors.p > 0 ? "<span class='indented'>@p: " + localize(selectors.p) + "</span><br>" : "") +
				(selectors.r > 0 ? "<span class='indented'>@r: " + localize(selectors.r) + "</span><br>" : "") +
				(selectors.s > 0 ? "<span class='indented'>@s: " + localize(selectors.s) + "</span><br>" : "") + "<br>"

			commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
			Object.keys(commands).forEach(cmd => {
				html += cmd + ": " + localize(commands[cmd]) + "<br>"
				if (cmdsBehindExecute[cmd]) html += "<span class='indented'>Behind execute: " + localize(cmdsBehindExecute[cmd]) +
					(cmd == "execute" ? " <small>(<code>... run execute ...</code> equals <code>... ...</code>)</small>" : "") + "</span><br>"
			})
			document.getElementById("result").innerHTML = html
		}
	}, 100)
}

async function selectFolder() {
	if (interval) clearInterval(interval)
	selected = null

	const input = document.createElement("input")
	input.type = "file"
	input.webkitdirectory = true
	input.onchange = e => {
		selected = e.target.files
		mainScan()
	}
	if ("showPicker" in HTMLInputElement.prototype) input.showPicker()
	else input.click()
}

async function selectZip() {
	if (interval) clearInterval(interval)

	const input = document.createElement("input")
	input.type = "file"
	input.accept = ".zip"
	input.onchange = e => handleZip(e.target.files[0])

	if ("showPicker" in HTMLInputElement.prototype) input.showPicker()
	else input.click()
}

function handleZip(file) {
	selected = []

	new JSZip().loadAsync(file).then(async zip => {
		for await (const file of Object.values(zip.files)) {
			selected.push({
				name: file.name,
				content: await file.async("text")
			})
		}
		mainScan()
	})
}