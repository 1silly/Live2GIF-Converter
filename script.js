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
let gifURL = null;


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
        Math.log(bytes) / Math.log(1024)
    );

    return (
        (bytes / Math.pow(1024, index))
            .toFixed(index ? 1 : 0)
        + " "
        + units[index]
    );
}


/* =========================
   FILE EXTENSION
========================= */

function getExtension(file) {
    return file.name
        .split(".")
        .pop()
        .toLowerCase();
}


/* =========================
   VALID FILE
========================= */

function isValidFile(file) {
    if (!file) {
        return false;
    }

    return /\.(livp|heic|heif|jpg|jpeg|mov|mp4|webm)$/i.test(
        file.name
    );
}


/* =========================
   IS VIDEO
========================= */

function isVideoFile(file) {
    if (!file) {
        return false;
    }

    return /\.(mov|mp4|webm)$/i.test(
        file.name
    );
}


/* =========================
   IS IMAGE
========================= */

function isLivePhotoImage(file) {
    if (!file) {
        return false;
    }

    return /\.(heic|heif|jpg|jpeg)$/i.test(
        file.name
    );
}


/* =========================
   IS LIVP
========================= */

function isLIVP(file) {
    return file &&
        /\.livp$/i.test(file.name);
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
        A .LIVP is a package containing
        the Live Photo image and MOV.
    */

    const zip = await JSZip.loadAsync(file);

    const entries = Object.values(zip.files);

    const movFile = entries.find(
        (entry) =>
            !entry.dir &&
            /\.mov$/i.test(entry.name)
    );

    if (!movFile) {
        throw new Error(
            "No MOV video was found inside this Live Photo."
        );
    }

    const movData = await movFile.async("blob");

    return new Blob(
        [movData],
        {
            type: "video/quicktime"
        }
    );
}


/* =========================
   FIND MOV FROM MULTIPLE FILES
========================= */

function findLivePhotoVideo(files) {

    /*
        When an iPhone Live Photo is exported,
        Windows can give you:

        IMG_1234.HEIC
        IMG_1234.MOV

        We only need the MOV for the GIF.
    */

    const movie = files.find(
        (file) => isVideoFile(file)
    );

    if (!movie) {
        return null;
    }

    return movie;
}


/* =========================
   LOAD VIDEO INTO PLAYER
========================= */

async function loadVideoBlob(blob) {

    if (videoURL) {
        URL.revokeObjectURL(videoURL);
        videoURL = null;
    }

    videoBlob = blob;

    videoURL = URL.createObjectURL(
        videoBlob
    );

    video.src = videoURL;
    video.load();

    await new Promise(
        (resolve, reject) => {

            let finished = false;

            const loaded = () => {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                resolve();
            };

            const failed = () => {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                reject(
                    new Error(
                        "Your browser cannot decode this Live Photo video. The MOV may use HEVC/H.265."
                    )
                );
            };

            const cleanup = () => {

                video.removeEventListener(
                    "loadedmetadata",
                    loaded
                );

                video.removeEventListener(
                    "error",
                    failed
                );
            };

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
}


/* =========================
   LOAD FILES
========================= */

async function loadFiles(files) {

    files = Array.from(files);

    if (!files.length) {
        return;
    }

    /*
        Remove invalid files.
    */

    const validFiles = files.filter(
        (file) => isValidFile(file)
    );

    if (!validFiles.length) {

        setStatus(
            "Unsupported file",
            "Use a .LIVP, .HEIC + .MOV, .JPEG + .MOV, .MOV, .MP4 or .WEBM file."
        );

        return;
    }


    /*
        Maximum size.
    */

    const totalSize = validFiles.reduce(
        (total, file) =>
            total + file.size,
        0
    );

    if (
        totalSize >
        200 * 1024 * 1024
    ) {

        setStatus(
            "Files are too large",
            "Maximum total file size is 200 MB."
        );

        return;
    }


    try {

        setStatus(
            "Loading Live Photo...",
            "Preparing your file."
        );


        /*
            CASE 1:
            .LIVP
        */

        const livpFile =
            validFiles.find(
                (file) => isLIVP(file)
            );


        if (livpFile) {

            originalFile = livpFile;

            setStatus(
                "Reading Live Photo...",
                "Extracting the motion from your .LIVP file..."
            );

            const blob =
                await extractLIVP(
                    livpFile
                );

            await loadVideoBlob(
                blob
            );

            showReady(
                livpFile,
                "LIVP Live Photo"
            );

            return;
        }


        /*
            CASE 2:
            HEIC/JPEG + MOV

            Example:

            IMG_1234.HEIC
            IMG_1234.MOV
        */

        const movieFile =
            findLivePhotoVideo(
                validFiles
            );

        const imageFile =
            validFiles.find(
                (file) =>
                    isLivePhotoImage(file)
            );


        if (
            movieFile &&
            imageFile
        ) {

            originalFile =
                imageFile;

            setStatus(
                "Reading Live Photo...",
                `${imageFile.name} + ${movieFile.name}`
            );

            /*
                The GIF only needs the
                motion component.
            */

            await loadVideoBlob(
                movieFile
            );

            showReady(
                imageFile,
                "Live Photo · HEIC/JPEG + MOV"
            );

            return;
        }


        /*
            CASE 3:
            Direct video
        */

        if (movieFile) {

            originalFile =
                movieFile;

            setStatus(
                "Loading video...",
                "Preparing your video."
            );

            await loadVideoBlob(
                movieFile
            );

            showReady(
                movieFile,
                "Video"
            );

            return;
        }


        /*
            Image only
        */

        if (imageFile) {

            setStatus(
                "Live Photo video missing",
                "Select the matching .MOV file together with your HEIC/JPEG."
            );

            return;
        }


        throw new Error(
            "No usable video was found."
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
   SHOW READY
========================= */

function showReady(
    file,
    type
) {

    workspace.classList.remove(
        "hidden"
    );

    result.classList.add(
        "hidden"
    );

    fileInfo.textContent =
        `${file.name} · ${formatBytes(file.size)} · ${type}`;

    setStatus(
        "Ready to convert",
        "Choose your settings and click Convert to GIF."
    );
}


/* =========================
   FILE INPUT
========================= */

fileInput.addEventListener(
    "change",
    (event) => {

        const files =
            event.target.files;

        if (files.length) {
            loadFiles(files);
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
    (eventName) => {

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
    (eventName) => {

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

        const files =
            event.dataTransfer.files;

        if (files.length) {
            loadFiles(files);
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


        if (gifURL) {

            URL.revokeObjectURL(
                gifURL
            );

            gifURL = null;
        }


        video.removeAttribute(
            "src"
        );

        video.load();


        originalFile = null;
        videoBlob = null;


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
   WAIT FOR SEEK
========================= */

function seekVideo(time) {

    return new Promise(
        (resolve, reject) => {

            let finished = false;

            const cleanup = () => {

                video.removeEventListener(
                    "seeked",
                    onSeeked
                );

                video.removeEventListener(
                    "error",
                    onError
                );
            };


            const done = () => {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                resolve();
            };


            const onSeeked = () => {
                done();
            };


            const onError = () => {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                reject(
                    new Error(
                        "Could not seek through the video."
                    )
                );
            };


            video.addEventListener(
                "seeked",
                onSeeked,
                {
                    once: true
                }
            );


            video.addEventListener(
                "error",
                onError,
                {
                    once: true
                }
            );


            video.currentTime =
                time;


            /*
                Some browsers seek instantly.
            */

            if (
                Math.abs(
                    video.currentTime -
                    time
                ) < 0.02
            ) {

                setTimeout(
                    done,
                    20
                );
            }
        }
    );
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

            setStatus(
                "No video loaded",
                "Please choose a Live Photo first."
            );

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
            Maximum GIF duration.
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

                quality:
                    quality,

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


                await seekVideo(
                    time
                );


                /*
                    Give browser a frame
                    to render.
                */

                await new Promise(
                    (resolve) =>
                        requestAnimationFrame(
                            resolve
                        )
                );


                const canvas =
                    createFrame(
                        width
                    );


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
                    "Reading Live Photo frames...";
            }


            /*
                Encoding.
            */

            progressText.textContent =
                "Creating GIF...";


            gif.on(
                "progress",
                (progress) => {

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

                    if (gifURL) {

                        URL.revokeObjectURL(
                            gifURL
                        );
                    }


                    gifURL =
                        URL.createObjectURL(
                            gifBlob
                        );


                    gifPreview.src =
                        gifURL;


                    downloadButton.href =
                        gifURL;


                    const originalName =
                        originalFile
                            ? originalFile.name
                                .replace(
                                    /\.[^/.]+$/,
                                    ""
                                )
                            : "live-photo";


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


                    setStatus(
                        "GIF created!",
                        "Your Live Photo has been converted successfully."
                    );


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
                "Your browser may not support the Live Photo's video codec. Try using a MOV encoded with H.264."
            );
        }
    }
);