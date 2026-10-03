const $ = (id) => document.getElementById(id);


/* =========================
   ELEMENTS
========================= */

const fileInput = $("fileInput");
const dropZone = $("dropZone");

const video = $("video");

const workspace = $("workspace");

const statusTitle = $("statusTitle");
const statusText = $("statusText");

const fileInfo = $("fileInfo");

const convertButton = $("convertButton");
const resetButton = $("resetButton");

const progressContainer = $("progressContainer");
const progressFill = $("progressFill");

const progressText = $("progressText");
const progressPercent = $("progressPercent");

const result = $("result");

const gifPreview = $("gifPreview");
const downloadButton = $("downloadButton");


/* =========================
   VARIABLES
========================= */

let originalFile = null;

let videoBlob = null;

let videoURL = null;


/* =========================
   STATUS
========================= */

function setStatus(title, text) {

    statusTitle.textContent = title;

    statusText.textContent = text;

}


/* =========================
   FILE SIZE
========================= */

function formatBytes(bytes) {

    if (bytes === 0) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    const index = Math.floor(
        Math.log(bytes) /
        Math.log(1024)
    );

    return (
        (bytes / Math.pow(1024, index))
            .toFixed(index ? 1 : 0)
        + " "
        + units[index]
    );

}


/* =========================
   VALID FILE
========================= */

function isValidFile(file) {

    if (!file) {
        return false;
    }

    return /\.(livp|mov|mp4|webm)$/i.test(
        file.name
    );

}


/* =========================
   EXTRACT LIVP
========================= */

async function extractLIVP(file) {

    if (!window.JSZip) {

        throw new Error(
            "JSZip failed to load. Check your internet connection."
        );

    }


    /*
        Apple .LIVP files are ZIP archives
        containing the Live Photo's MOV file.
    */

    const zip =
        await JSZip.loadAsync(file);


    const entries =
        Object.values(zip.files);


    const movFile =
        entries.find(
            entry =>
                !entry.dir &&
                /\.mov$/i.test(entry.name)
        );


    if (!movFile) {

        throw new Error(
            "No MOV video was found inside this LIVP."
        );

    }


    const movData =
        await movFile.async("blob");


    return new Blob(
        [movData],
        {
            type: "video/quicktime"
        }
    );

}


/* =========================
   LOAD FILE
========================= */

async function loadFile(file) {

    if (!isValidFile(file)) {

        setStatus(
            "Unsupported file",
            "Use a .LIVP, .MOV, .MP4 or .WEBM file."
        );

        return;
    }


    /*
        200 MB maximum.
    */

    if (
        file.size >
        200 * 1024 * 1024
    ) {

        setStatus(
            "File is too large",
            "Maximum file size is 200 MB."
        );

        return;
    }


    try {

        setStatus(
            "Loading...",
            file.name
                .toLowerCase()
                .endsWith(".livp")
                ? "Extracting the video from your Live Photo..."
                : "Preparing your video..."
        );


        originalFile = file;


        /*
            If LIVP:
            extract the MOV.

            Otherwise:
            use the video directly.
        */

        if (
            /\.livp$/i.test(
                file.name
            )
        ) {

            videoBlob =
                await extractLIVP(file);

        } else {

            videoBlob = file;

        }


        /*
            Create temporary browser URL.
        */

        if (videoURL) {

            URL.revokeObjectURL(
                videoURL
            );

        }


        videoURL =
            URL.createObjectURL(
                videoBlob
            );


        video.src = videoURL;

        video.load();


        /*
            Wait for browser to read video.
        */

        await new Promise(
            (resolve, reject) => {

                const loaded = () => {

                    cleanup();

                    resolve();

                };


                const failed = () => {

                    cleanup();

                    reject(
                        new Error(
                            "Your browser cannot decode this video's codec."
                        )
                    );

                };


                function cleanup() {

                    video.removeEventListener(
                        "loadedmetadata",
                        loaded
                    );

                    video.removeEventListener(
                        "error",
                        failed
                    );

                }


                video.addEventListener(
                    "loadedmetadata",
                    loaded,
                    {
                        once: true
                    }
                );


                video.addEventListener(
                    "error",
                    failed,
                    {
                        once: true
                    }
                );

            }
        );


        workspace.classList.remove(
            "hidden"
        );


        result.classList.add(
            "hidden"
        );


        fileInfo.textContent =
            `${file.name} · ${formatBytes(file.size)}` +
            (
                /\.livp$/i.test(file.name)
                    ? " · MOV extracted from LIVP"
                    : ""
            );


        setStatus(
            "Ready to convert",
            "Choose your settings and click Convert to GIF."
        );

    }

    catch (error) {

        console.error(error);

        workspace.classList.add(
            "hidden"
        );

        setStatus(
            "Could not read this file",
            error.message
        );

    }

}


/* =========================
   FILE INPUT
========================= */

fileInput.addEventListener(
    "change",
    (event) => {

        const file =
            event.target.files[0];

        if (file) {

            loadFile(file);

        }

    }
);


/* =========================
   DRAG & DROP
========================= */

[
    "dragenter",
    "dragover"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            (event) => {

                event.preventDefault();

                dropZone.classList.add(
                    "dragging"
                );

            }
        );

    }
);


[
    "dragleave",
    "drop"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            (event) => {

                event.preventDefault();

                dropZone.classList.remove(
                    "dragging"
                );

            }
        );

    }
);


dropZone.addEventListener(
    "drop",
    (event) => {

        const file =
            event.dataTransfer.files[0];

        if (file) {

            loadFile(file);

        }

    }
);


/* =========================
   RESET
========================= */

resetButton.addEventListener(
    "click",
    () => {

        fileInput.value = "";

        workspace.classList.add(
            "hidden"
        );

        progressContainer.classList.add(
            "hidden"
        );

        result.classList.add(
            "hidden"
        );


        if (videoURL) {

            URL.revokeObjectURL(
                videoURL
            );

            videoURL = null;

        }


        video.removeAttribute(
            "src"
        );

        video.load();


        setStatus(
            "Waiting for a file",
            "Your file stays on your device."
        );

    }
);


/* =========================
   CREATE CANVAS FRAME
========================= */

function createFrame(width) {

    const aspectRatio =
        video.videoHeight /
        video.videoWidth;


    const height =
        Math.round(
            width * aspectRatio
        );


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width = width;

    canvas.height = height;


    const context =
        canvas.getContext(
            "2d"
        );


    context.drawImage(
        video,
        0,
        0,
        width,
        height
    );


    return canvas;

}


/* =========================
   CONVERT
========================= */

convertButton.addEventListener(
    "click",
    async () => {

        if (
            !video.duration ||
            !video.videoWidth
        ) {

            return;

        }


        convertButton.disabled =
            true;


        progressContainer.classList.remove(
            "hidden"
        );


        result.classList.add(
            "hidden"
        );


        progressFill.style.width =
            "0%";


        progressPercent.textContent =
            "0%";


        const fps =
            Number(
                $("fps").value
            );


        const width =
            Number(
                $("gifWidth").value
            );


        const quality =
            Number(
                $("quality").value
            );


        const reverse =
            $("reverse").checked;


        const loop =
            $("loop").checked;


        /*
            Don't make enormous GIFs.
            15 seconds maximum.
        */

        const duration =
            Math.min(
                video.duration,
                15
            );


        const frameCount =
            Math.max(
                2,
                Math.floor(
                    duration * fps
                )
            );


        let times =
            Array.from(
                {
                    length: frameCount
                },
                (_, index) =>
                    Math.min(
                        duration - 0.001,
                        index / fps
                    )
            );


        if (reverse) {

            times.reverse();

        }


        /*
            Create GIF encoder.
        */

        const firstCanvas =
            createFrame(width);


        const gif =
            new GIF({

                workers: 2,

                quality: quality,

                width:
                    firstCanvas.width,

                height:
                    firstCanvas.height,

                repeat:
                    loop
                        ? 0
                        : -1,

                workerScript:
                    "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js"

            });


        try {

            /*
                Capture every frame.
            */

            for (
                let i = 0;
                i < times.length;
                i++
            ) {

                const time =
                    times[i];


                video.currentTime =
                    time;


                await new Promise(
                    resolve => {

                        if (
                            Math.abs(
                                video.currentTime -
                                time
                            ) < 0.02
                        ) {

                            resolve();

                            return;

                        }


                        video.addEventListener(
                            "seeked",
                            resolve,
                            {
                                once: true
                            }
                        );

                    }
                );


                /*
                    Give the browser one frame
                    to render after seeking.
                */

                await new Promise(
                    resolve =>
                        requestAnimationFrame(
                            resolve
                        )
                );


                const canvas =
                    createFrame(width);


                gif.addFrame(
                    canvas,
                    {
                        delay:
                            Math.round(
                                1000 / fps
                            ),

                        copy: true
                    }
                );


                const percent =
                    Math.round(
                        (
                            (i + 1) /
                            times.length
                        ) * 85
                    );


                progressFill.style.width =
                    percent + "%";


                progressPercent.textContent =
                    percent + "%";


                progressText.textContent =
                    "Reading frames...";

            }


            progressText.textContent =
                "Encoding GIF...";


            /*
                GIF encoder progress.
            */

            gif.on(
                "progress",
                progress => {

                    const percent =
                        85 +
                        Math.round(
                            progress * 14
                        );


                    progressFill.style.width =
                        percent + "%";


                    progressPercent.textContent =
                        percent + "%";

                }
            );


            /*
                Finished.
            */

            gif.on(
                "finished",
                (gifBlob) => {

                    const gifURL =
                        URL.createObjectURL(
                            gifBlob
                        );


                    gifPreview.src =
                        gifURL;


                    downloadButton.href =
                        gifURL;


                    const originalName =
                        originalFile
                            .name
                            .replace(
                                /\.[^/.]+$/,
                                ""
                            );


                    downloadButton.download =
                        originalName +
                        ".gif";


                    progressFill.style.width =
                        "100%";


                    progressPercent.textContent =
                        "100%";


                    progressText.textContent =
                        "Finished!";


                    result.classList.remove(
                        "hidden"
                    );


                    convertButton.disabled =
                        false;


                    result.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                }
            );


            gif.render();

        }

        catch (error) {

            console.error(error);

            progressContainer.classList.add(
                "hidden"
            );


            convertButton.disabled =
                false;


            setStatus(
                "Conversion failed",
                "Your browser may not support this video's codec. Try exporting the Live Photo as an MP4."
            );

        }

    }
);