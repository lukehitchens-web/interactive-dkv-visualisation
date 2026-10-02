"use strict";

/* ==========================================================
   DYNAMIC KNEE VALGUS INTERACTIVE VISUALISATION

   CAMERA BEHAVIOUR

   drag left/right  = azimuth
   drag up/down     = elevation
   mouse wheel      = zoom

   No translation.
   No roll.
   No flipping.

   Horizontal drag direction:
   dragging RIGHT rotates the view towards the participant's
   LEFT side when starting from the front-facing view.
========================================================== */


/* ==========================================================
   STAGES
========================================================== */

const STAGES = [

    {
        title: "Movement model",

        subtitle:
            "Three-dimensional marker and segment representation",

        description:
            "The movement is represented using anatomical landmarks " +
            "derived from OpenCap. Segment lines connect the retained " +
            "landmarks to provide anatomical context for the subsequent " +
            "dynamic knee valgus calculation."
    },

    {
        title: "Identify markers",

        subtitle:
            "Locate the four landmarks required for the calculation",

        description:
            "Four landmarks are required. The ASIS and knee define the " +
            "true thigh vector, while the ASIS, lateral ankle and 5th " +
            "metatarsal define the reference plane."
    },

    {
        title: "Identify thigh vector",

        subtitle:
            "Create the true ASIS-to-knee vector",

        description:
            "The thigh vector is constructed from the ASIS to the lateral " +
            "knee marker. This three-dimensional vector represents the " +
            "actual orientation of the thigh."
    },

    {
        title: "Create reference plane",

        subtitle:
            "Define the plane using the ASIS, ankle and 5th metatarsal",

        description:
            "A three-dimensional reference plane is defined by the ASIS, " +
            "lateral ankle and 5th metatarsal. The triangular region shows " +
            "the three landmarks used to establish the orientation of the " +
            "reference plane."
    },

    {
        title: "Extend reference plane",

        subtitle:
            "Visualise the full mathematical plane",

        description:
            "The triangular region identifies the three landmarks defining " +
            "the plane. Mathematically, however, the plane extends beyond " +
            "these points. The enlarged surface illustrates this extended " +
            "reference plane."
    },

    {
        title: "Project thigh vector",

        subtitle:
            "Orthogonally project the thigh vector onto the reference plane",

        description:
            "The true thigh vector is projected orthogonally onto the " +
            "reference plane. The blue vector represents this projection. " +
            "The dashed line joining the true and projected knee positions " +
            "represents the component perpendicular to the plane."
    },

    {
        title: "Compute DKV angle",

        subtitle:
            "Measure the three-dimensional deviation from the reference plane",

        description:
            "Dynamic knee valgus is calculated as the unsigned " +
            "three-dimensional angle between the true ASIS-to-knee vector " +
            "and its orthogonal projection onto the reference plane. " +
            "A larger angle therefore represents greater deviation of the " +
            "thigh vector out of the reference plane."
    }

];


/* ==========================================================
   COLOURS
========================================================== */

const COLOURS = {

    contextMarker: "#8c8c8c",

    segment: "#383838",

    asis: "crimson",

    knee: "darkorange",

    ankle: "seagreen",

    meta5: "mediumorchid",

    trueVector: "crimson",

    projectedVector: "royalblue",

    angle: "darkorange",

    perpendicular: "#111111"

};


/* ==========================================================
   CAMERA SETTINGS
========================================================== */

const INITIAL_AZIMUTH_DEG = -50;

const INITIAL_ELEVATION_DEG = 18;


/*
   Smaller distance = closer / more zoomed in.
*/
const INITIAL_CAMERA_DISTANCE = 1.85;


/*
   Restrict vertical rotation so the model cannot flip.
*/
const MIN_ELEVATION_DEG = -65;

const MAX_ELEVATION_DEG = 65;


/*
   Zoom limits.
*/
const MIN_CAMERA_DISTANCE = 0.85;

const MAX_CAMERA_DISTANCE = 4.00;


/*
   Interaction sensitivity.
*/
const ROTATION_SENSITIVITY = 0.30;

const ZOOM_SENSITIVITY = 0.0012;


/* ==========================================================
   GLOBAL STATE
========================================================== */

let geometryData = null;

let currentStage = 0;

let modelCentre = [
    0,
    0,
    0
];

let modelRadius = 1;


/*
   Custom camera state.
*/
let cameraAzimuth =
    INITIAL_AZIMUTH_DEG;

let cameraElevation =
    INITIAL_ELEVATION_DEG;

let cameraDistance =
    INITIAL_CAMERA_DISTANCE;


/*
   Pointer drag state.
*/
let isDragging = false;

let lastPointerX = 0;

let lastPointerY = 0;

let activePointerId = null;


/* ==========================================================
   DOM REFERENCES
========================================================== */

const plotElement =
    document.getElementById(
        "dkv-plot"
    );

const stepLabel =
    document.getElementById(
        "step-label"
    );

const progressBar =
    document.getElementById(
        "progress-bar"
    );

const stageTitle =
    document.getElementById(
        "stage-title"
    );

const stageSubtitle =
    document.getElementById(
        "stage-subtitle"
    );

const stageDescription =
    document.getElementById(
        "stage-description"
    );

const resultCard =
    document.getElementById(
        "result-card"
    );

const resultValue =
    document.getElementById(
        "result-value"
    );

const backButton =
    document.getElementById(
        "back-button"
    );

const nextButton =
    document.getElementById(
        "next-button"
    );

const resetViewButton =
    document.getElementById(
        "reset-view"
    );


/* ==========================================================
   INITIALISE
========================================================== */

async function initialiseApp() {

    try {

        const response =
            await fetch(
                "geometry.json"
            );


        if (!response.ok) {

            throw new Error(
                `Could not load geometry.json (${response.status})`
            );

        }


        geometryData =
            await response.json();


        initialiseProgressBar();

        calculateModelBounds();

        attachEventListeners();

        attachCustomCameraControls();


        await renderStage();


    } catch (error) {

        console.error(
            error
        );


        plotElement.innerHTML = `

            <div style="
                height:100%;
                display:flex;
                align-items:center;
                justify-content:center;
                padding:30px;
                text-align:center;
                font-family:Segoe UI,Arial,sans-serif;
                color:#991b1b;
            ">

                <div>

                    <strong>
                        Unable to load the visualisation.
                    </strong>

                    <br><br>

                    Make sure
                    <code>geometry.json</code>
                    is in the same folder and that the site
                    is being accessed through the local web server.

                </div>

            </div>
        `;

    }

}


/* ==========================================================
   PROGRESS BAR
========================================================== */

function initialiseProgressBar() {

    progressBar.innerHTML = "";


    for (
        let i = 0;
        i < STAGES.length;
        i++
    ) {

        const segment =
            document.createElement(
                "div"
            );


        segment.className =
            "progress-segment";


        progressBar.appendChild(
            segment
        );

    }

}


function updateProgressBar() {

    const segments =
        progressBar.querySelectorAll(
            ".progress-segment"
        );


    segments.forEach(
        (
            segment,
            index
        ) => {

            if (
                index <= currentStage
            ) {

                segment.classList.add(
                    "active"
                );

            } else {

                segment.classList.remove(
                    "active"
                );

            }

        }
    );

}


/* ==========================================================
   BASIC VECTOR FUNCTIONS
========================================================== */

function add(
    a,
    b
) {

    return [

        a[0] + b[0],

        a[1] + b[1],

        a[2] + b[2]

    ];

}


function subtract(
    a,
    b
) {

    return [

        a[0] - b[0],

        a[1] - b[1],

        a[2] - b[2]

    ];

}


function multiply(
    vector,
    scalar
) {

    return [

        vector[0] * scalar,

        vector[1] * scalar,

        vector[2] * scalar

    ];

}


function dot(
    a,
    b
) {

    return (
        a[0] * b[0]
        +
        a[1] * b[1]
        +
        a[2] * b[2]
    );

}


function cross(
    a,
    b
) {

    return [

        a[1] * b[2]
        -
        a[2] * b[1],

        a[2] * b[0]
        -
        a[0] * b[2],

        a[0] * b[1]
        -
        a[1] * b[0]

    ];

}


function norm(
    vector
) {

    return Math.sqrt(
        dot(
            vector,
            vector
        )
    );

}


function normalise(
    vector
) {

    const magnitude =
        norm(
            vector
        );


    if (
        magnitude === 0
    ) {

        return [
            0,
            0,
            0
        ];

    }


    return multiply(
        vector,
        1 / magnitude
    );

}


/* ==========================================================
   DISPLAY COORDINATE TRANSFORMATION
========================================================== */

function toDisplayCoordinates(
    point
) {

    const order =
        geometryData
            .coordinate_system
            .display_axis_order;


    const signs =
        geometryData
            .coordinate_system
            .display_axis_sign;


    return [

        point[
            order[0]
        ]
        *
        signs[0],

        point[
            order[1]
        ]
        *
        signs[1],

        point[
            order[2]
        ]
        *
        signs[2]

    ];

}


/* ==========================================================
   DKV POINTS
========================================================== */

function getDKVPoints() {

    const names =
        geometryData
            .dkv_markers;


    return {

        asis:
            geometryData
                .markers[
                    names.asis
                ],

        knee:
            geometryData
                .markers[
                    names.knee
                ],

        ankle:
            geometryData
                .markers[
                    names.ankle
                ],

        meta5:
            geometryData
                .markers[
                    names.meta5
                ]

    };

}


/* ==========================================================
   EXTENDED PLANE GEOMETRY
========================================================== */

function createExtendedPlane() {

    const points =
        getDKVPoints();


    const asis =
        points.asis;

    const ankle =
        points.ankle;

    const knee =
        points.knee;

    const meta5 =
        points.meta5;


    const normal =
        geometryData
            .dkv_geometry
            .plane_normal;


    let axis1 =
        subtract(
            ankle,
            asis
        );


    axis1 =
        normalise(
            axis1
        );


    let axis2 =
        cross(
            normal,
            axis1
        );


    axis2 =
        normalise(
            axis2
        );


    const scale =
        Math.max(

            norm(
                subtract(
                    ankle,
                    asis
                )
            ),

            norm(
                subtract(
                    meta5,
                    asis
                )
            ),

            norm(
                subtract(
                    knee,
                    asis
                )
            )

        );


    const uMin =
        -0.22 * scale;

    const uMax =
        1.12 * scale;

    const vMin =
        -0.62 * scale;

    const vMax =
        0.62 * scale;


    const p1 =
        add(

            add(
                asis,
                multiply(
                    axis1,
                    uMin
                )
            ),

            multiply(
                axis2,
                vMin
            )

        );


    const p2 =
        add(

            add(
                asis,
                multiply(
                    axis1,
                    uMax
                )
            ),

            multiply(
                axis2,
                vMin
            )

        );


    const p3 =
        add(

            add(
                asis,
                multiply(
                    axis1,
                    uMax
                )
            ),

            multiply(
                axis2,
                vMax
            )

        );


    const p4 =
        add(

            add(
                asis,
                multiply(
                    axis1,
                    uMin
                )
            ),

            multiply(
                axis2,
                vMax
            )

        );


    return [
        p1,
        p2,
        p3,
        p4
    ];

}


/* ==========================================================
   MODEL BOUNDS
========================================================== */

function calculateModelBounds() {

    const points = [];


    Object.values(
        geometryData.markers
    ).forEach(
        point => {

            points.push(
                toDisplayCoordinates(
                    point
                )
            );

        }
    );


    points.push(

        toDisplayCoordinates(

            geometryData
                .dkv_geometry
                .projected_knee

        )

    );


    createExtendedPlane()
        .forEach(
            point => {

                points.push(
                    toDisplayCoordinates(
                        point
                    )
                );

            }
        );


    const mins = [
        Infinity,
        Infinity,
        Infinity
    ];


    const maxs = [
        -Infinity,
        -Infinity,
        -Infinity
    ];


    points.forEach(
        point => {

            for (
                let i = 0;
                i < 3;
                i++
            ) {

                mins[i] =
                    Math.min(
                        mins[i],
                        point[i]
                    );


                maxs[i] =
                    Math.max(
                        maxs[i],
                        point[i]
                    );

            }

        }
    );


    modelCentre = [

        (
            mins[0]
            +
            maxs[0]
        ) / 2,

        (
            mins[1]
            +
            maxs[1]
        ) / 2,

        (
            mins[2]
            +
            maxs[2]
        ) / 2

    ];


    const largestRange =
        Math.max(

            maxs[0] - mins[0],

            maxs[1] - mins[1],

            maxs[2] - mins[2]

        );


    modelRadius =
        largestRange * 0.60;


    if (
        modelRadius <= 0
    ) {

        modelRadius = 1;

    }

}


/* ==========================================================
   CAMERA
========================================================== */

function degreesToRadians(
    degrees
) {

    return (
        degrees
        *
        Math.PI
        /
        180
    );

}


function getCamera() {

    const azimuth =
        degreesToRadians(
            cameraAzimuth
        );


    const elevation =
        degreesToRadians(
            cameraElevation
        );


    const horizontalDistance =
        cameraDistance
        *
        Math.cos(
            elevation
        );


    const x =
        horizontalDistance
        *
        Math.cos(
            azimuth
        );


    const y =
        horizontalDistance
        *
        Math.sin(
            azimuth
        );


    const z =
        cameraDistance
        *
        Math.sin(
            elevation
        );


    return {

        eye: {

            x: x,

            y: y,

            z: z

        },


        center: {

            x: 0,

            y: 0,

            z: 0

        },


        up: {

            x: 0,

            y: 0,

            z: 1

        }

    };

}


/* ==========================================================
   APPLY CAMERA
========================================================== */

function applyCamera() {

    if (
        !plotElement ||
        !plotElement.layout
    ) {

        return;

    }


    Plotly.relayout(

        plotElement,

        {

            "scene.camera":
                getCamera()

        }

    );

}


/* ==========================================================
   CUSTOM CAMERA CONTROLS
========================================================== */

function attachCustomCameraControls() {

    plotElement.style.touchAction =
        "none";


    plotElement.style.cursor =
        "grab";


    /* ------------------------------------------------------
       POINTER DOWN
    ------------------------------------------------------ */

    plotElement.addEventListener(

        "pointerdown",

        event => {

            if (
                event.pointerType === "mouse"
                &&
                event.button !== 0
            ) {

                return;

            }


            event.preventDefault();

            event.stopPropagation();


            isDragging = true;

            activePointerId =
                event.pointerId;


            lastPointerX =
                event.clientX;

            lastPointerY =
                event.clientY;


            plotElement.style.cursor =
                "grabbing";


            try {

                plotElement.setPointerCapture(
                    event.pointerId
                );

            } catch (error) {

                /*
                   No action required.
                */

            }

        },

        {
            capture: true
        }

    );


    /* ------------------------------------------------------
       POINTER MOVE
    ------------------------------------------------------ */

    plotElement.addEventListener(

        "pointermove",

        event => {

            if (
                !isDragging
                ||
                event.pointerId !== activePointerId
            ) {

                return;

            }


            event.preventDefault();

            event.stopPropagation();


            const deltaX =
                event.clientX
                -
                lastPointerX;


            const deltaY =
                event.clientY
                -
                lastPointerY;


            lastPointerX =
                event.clientX;

            lastPointerY =
                event.clientY;


            /* ==================================================
               HORIZONTAL DRAG = AZIMUTH

               IMPORTANT:
               Direction has been REVERSED.

               Drag RIGHT:
                   cameraAzimuth decreases.

               Drag LEFT:
                   cameraAzimuth increases.

               From the front-facing view, dragging right
               therefore moves the view towards the
               participant's LEFT side.
            ================================================== */

            cameraAzimuth -=
                deltaX
                *
                ROTATION_SENSITIVITY;


            /*
               Keep azimuth within -180 to +180.
            */

            cameraAzimuth =
                (
                    (
                        cameraAzimuth
                        +
                        180
                    )
                    %
                    360
                    +
                    360
                )
                %
                360
                -
                180;


            /* ==================================================
               VERTICAL DRAG = ELEVATION
            ================================================== */

            cameraElevation +=
                deltaY
                *
                ROTATION_SENSITIVITY;


            cameraElevation =
                Math.max(

                    MIN_ELEVATION_DEG,

                    Math.min(

                        MAX_ELEVATION_DEG,

                        cameraElevation

                    )

                );


            applyCamera();

        },

        {
            capture: true
        }

    );


    /* ------------------------------------------------------
       END DRAG
    ------------------------------------------------------ */

    const stopDragging =
        event => {

            if (
                event.pointerId !== activePointerId
            ) {

                return;

            }


            event.preventDefault();

            event.stopPropagation();


            isDragging = false;

            activePointerId = null;


            plotElement.style.cursor =
                "grab";


            try {

                plotElement.releasePointerCapture(
                    event.pointerId
                );

            } catch (error) {

                /*
                   No action required.
                */

            }

        };


    plotElement.addEventListener(

        "pointerup",

        stopDragging,

        {
            capture: true
        }

    );


    plotElement.addEventListener(

        "pointercancel",

        stopDragging,

        {
            capture: true
        }

    );


    /* ------------------------------------------------------
       WHEEL = ZOOM ONLY
    ------------------------------------------------------ */

    plotElement.addEventListener(

        "wheel",

        event => {

            event.preventDefault();

            event.stopPropagation();


            const zoomFactor =
                Math.exp(

                    event.deltaY
                    *
                    ZOOM_SENSITIVITY

                );


            cameraDistance *=
                zoomFactor;


            cameraDistance =
                Math.max(

                    MIN_CAMERA_DISTANCE,

                    Math.min(

                        MAX_CAMERA_DISTANCE,

                        cameraDistance

                    )

                );


            applyCamera();

        },

        {
            passive: false,
            capture: true
        }

    );


    /* ------------------------------------------------------
       DISABLE CONTEXT MENU ON PLOT
    ------------------------------------------------------ */

    plotElement.addEventListener(

        "contextmenu",

        event => {

            event.preventDefault();

        }

    );

}


/* ==========================================================
   CONTEXT MARKERS
========================================================== */

function createContextMarkerTrace() {

    const x = [];

    const y = [];

    const z = [];


    Object.values(
        geometryData.markers
    ).forEach(
        point => {

            const displayPoint =
                toDisplayCoordinates(
                    point
                );


            x.push(
                displayPoint[0]
            );

            y.push(
                displayPoint[1]
            );

            z.push(
                displayPoint[2]
            );

        }
    );


    return {

        type: "scatter3d",

        mode: "markers",

        x: x,

        y: y,

        z: z,

        hoverinfo: "skip",

        marker: {

            size: 4,

            color:
                COLOURS.contextMarker,

            opacity: 0.58

        },

        showlegend: false

    };

}


/* ==========================================================
   SEGMENT TRACE
========================================================== */

function createSegmentTrace() {

    const x = [];

    const y = [];

    const z = [];


    geometryData
        .segments
        .forEach(
            segment => {

                const pointA =
                    geometryData
                        .markers[
                            segment[0]
                        ];


                const pointB =
                    geometryData
                        .markers[
                            segment[1]
                        ];


                if (
                    !pointA
                    ||
                    !pointB
                ) {

                    return;

                }


                const a =
                    toDisplayCoordinates(
                        pointA
                    );


                const b =
                    toDisplayCoordinates(
                        pointB
                    );


                x.push(
                    a[0],
                    b[0],
                    null
                );


                y.push(
                    a[1],
                    b[1],
                    null
                );


                z.push(
                    a[2],
                    b[2],
                    null
                );

            }
        );


    return {

        type: "scatter3d",

        mode: "lines",

        x: x,

        y: y,

        z: z,

        hoverinfo: "skip",

        line: {

            color:
                COLOURS.segment,

            width: 6

        },

        showlegend: false

    };

}


/* ==========================================================
   LANDMARK TRACE
========================================================== */

function createLandmarkTrace(
    point,
    label,
    colour
) {

    const displayPoint =
        toDisplayCoordinates(
            point
        );


    return {

        type: "scatter3d",

        mode: "markers+text",

        x: [
            displayPoint[0]
        ],

        y: [
            displayPoint[1]
        ],

        z: [
            displayPoint[2]
        ],

        text: [
            label
        ],

        textposition:
            "middle right",

        textfont: {

            size: 13,

            color: colour,

            family:
                "Segoe UI, Arial, sans-serif"

        },

        marker: {

            size: 8,

            color: colour,

            line: {

                color: "#111111",

                width: 1

            }

        },

        hoverinfo: "skip",

        showlegend: false

    };

}


/* ==========================================================
   LINE TRACE
========================================================== */

function createLineTrace(
    start,
    end,
    colour,
    width = 8,
    dash = "solid"
) {

    const a =
        toDisplayCoordinates(
            start
        );


    const b =
        toDisplayCoordinates(
            end
        );


    return {

        type: "scatter3d",

        mode: "lines",

        x: [
            a[0],
            b[0]
        ],

        y: [
            a[1],
            b[1]
        ],

        z: [
            a[2],
            b[2]
        ],

        hoverinfo: "skip",

        line: {

            color: colour,

            width: width,

            dash: dash

        },

        showlegend: false

    };

}


/* ==========================================================
   TRIANGULAR REFERENCE PLANE
========================================================== */

function createTrianglePlaneTrace() {

    const points =
        getDKVPoints();


    const asis =
        toDisplayCoordinates(
            points.asis
        );


    const ankle =
        toDisplayCoordinates(
            points.ankle
        );


    const meta5 =
        toDisplayCoordinates(
            points.meta5
        );


    return {

        type: "mesh3d",

        x: [
            asis[0],
            ankle[0],
            meta5[0]
        ],

        y: [
            asis[1],
            ankle[1],
            meta5[1]
        ],

        z: [
            asis[2],
            ankle[2],
            meta5[2]
        ],

        i: [
            0
        ],

        j: [
            1
        ],

        k: [
            2
        ],

        color:
            "cornflowerblue",

        opacity: 0.30,

        flatshading: true,

        hoverinfo: "skip",

        showlegend: false

    };

}


/* ==========================================================
   EXTENDED REFERENCE PLANE TRACE
========================================================== */

function createExtendedPlaneTrace() {

    const plane =
        createExtendedPlane()
            .map(
                point =>
                    toDisplayCoordinates(
                        point
                    )
            );


    return {

        type: "mesh3d",

        x:
            plane.map(
                point =>
                    point[0]
            ),

        y:
            plane.map(
                point =>
                    point[1]
            ),

        z:
            plane.map(
                point =>
                    point[2]
            ),

        i: [
            0,
            0
        ],

        j: [
            1,
            2
        ],

        k: [
            2,
            3
        ],

        color:
            "cornflowerblue",

        opacity: 0.13,

        flatshading: true,

        hoverinfo: "skip",

        showlegend: false

    };

}


/* ==========================================================
   ANGLE ARC
========================================================== */

function createAngleArcPoints() {

    const points =
        getDKVPoints();


    const origin =
        points.asis;


    const vector1 =
        geometryData
            .dkv_geometry
            .thigh_vector;


    const vector2 =
        geometryData
            .dkv_geometry
            .projected_thigh_vector;


    const length1 =
        norm(
            vector1
        );


    const length2 =
        norm(
            vector2
        );


    if (
        length1 === 0
        ||
        length2 === 0
    ) {

        return [];

    }


    const unit1 =
        normalise(
            vector1
        );


    const unit2 =
        normalise(
            vector2
        );


    let cosine =
        dot(
            unit1,
            unit2
        );


    cosine =
        Math.max(
            -1,
            Math.min(
                1,
                cosine
            )
        );


    const theta =
        Math.acos(
            cosine
        );


    if (
        theta < 1e-8
    ) {

        return [];

    }


    const radius =
        0.27
        *
        Math.min(
            length1,
            length2
        );


    const sinTheta =
        Math.sin(
            theta
        );


    const arc = [];

    const numberOfPoints = 80;


    for (
        let i = 0;
        i < numberOfPoints;
        i++
    ) {

        const t =
            i
            /
            (
                numberOfPoints
                -
                1
            );


        const coefficient1 =
            Math.sin(
                (1 - t)
                *
                theta
            )
            /
            sinTheta;


        const coefficient2 =
            Math.sin(
                t
                *
                theta
            )
            /
            sinTheta;


        const direction = [

            coefficient1
            *
            unit1[0]
            +
            coefficient2
            *
            unit2[0],

            coefficient1
            *
            unit1[1]
            +
            coefficient2
            *
            unit2[1],

            coefficient1
            *
            unit1[2]
            +
            coefficient2
            *
            unit2[2]

        ];


        arc.push(

            add(

                origin,

                multiply(
                    direction,
                    radius
                )

            )

        );

    }


    return arc;

}


/* ==========================================================
   ANGLE TRACE
========================================================== */

function createAngleTrace() {

    const arc =
        createAngleArcPoints()
            .map(
                point =>
                    toDisplayCoordinates(
                        point
                    )
            );


    return {

        type: "scatter3d",

        mode: "lines",

        x:
            arc.map(
                point =>
                    point[0]
            ),

        y:
            arc.map(
                point =>
                    point[1]
            ),

        z:
            arc.map(
                point =>
                    point[2]
            ),

        hoverinfo: "skip",

        line: {

            color:
                COLOURS.angle,

            width: 8

        },

        showlegend: false

    };

}


/* ==========================================================
   BUILD CURRENT STAGE
========================================================== */

function buildStageTraces() {

    const traces = [

        createSegmentTrace(),

        createContextMarkerTrace()

    ];


    const points =
        getDKVPoints();


    /* ------------------------------------------------------
       IDENTIFY MARKERS
    ------------------------------------------------------ */

    if (
        currentStage >= 1
    ) {

        traces.push(

            createLandmarkTrace(
                points.asis,
                "ASIS",
                COLOURS.asis
            ),

            createLandmarkTrace(
                points.knee,
                "Knee",
                COLOURS.knee
            ),

            createLandmarkTrace(
                points.ankle,
                "Ankle",
                COLOURS.ankle
            ),

            createLandmarkTrace(
                points.meta5,
                "5th met",
                COLOURS.meta5
            )

        );

    }


    /* ------------------------------------------------------
       TRUE THIGH VECTOR
    ------------------------------------------------------ */

    if (
        currentStage >= 2
    ) {

        traces.push(

            createLineTrace(
                points.asis,
                points.knee,
                COLOURS.trueVector,
                9
            )

        );

    }


    /* ------------------------------------------------------
       TRIANGULAR REFERENCE PLANE
    ------------------------------------------------------ */

    if (
        currentStage >= 3
    ) {

        traces.push(
            createTrianglePlaneTrace()
        );

    }


    /* ------------------------------------------------------
       EXTENDED REFERENCE PLANE
    ------------------------------------------------------ */

    if (
        currentStage >= 4
    ) {

        traces.splice(

            2,

            0,

            createExtendedPlaneTrace()

        );

    }


    /* ------------------------------------------------------
       PROJECT THIGH VECTOR
    ------------------------------------------------------ */

    if (
        currentStage >= 5
    ) {

        const projectedKnee =
            geometryData
                .dkv_geometry
                .projected_knee;


        traces.push(

            createLineTrace(
                points.asis,
                projectedKnee,
                COLOURS.projectedVector,
                9
            ),

            createLandmarkTrace(
                projectedKnee,
                "Projected knee",
                COLOURS.projectedVector
            ),

            createLineTrace(
                points.knee,
                projectedKnee,
                COLOURS.perpendicular,
                5,
                "dash"
            )

        );

    }


    /* ------------------------------------------------------
       DKV ANGLE
    ------------------------------------------------------ */

    if (
        currentStage >= 6
    ) {

        traces.push(
            createAngleTrace()
        );

    }


    return traces;

}


/* ==========================================================
   SCENE
========================================================== */

function createScene() {

    return {

        xaxis: {

            visible: false,

            showgrid: false,

            zeroline: false,

            showline: false,

            showticklabels: false,

            fixedrange: true,

            range: [

                modelCentre[0]
                -
                modelRadius,

                modelCentre[0]
                +
                modelRadius

            ]

        },


        yaxis: {

            visible: false,

            showgrid: false,

            zeroline: false,

            showline: false,

            showticklabels: false,

            fixedrange: true,

            range: [

                modelCentre[1]
                -
                modelRadius,

                modelCentre[1]
                +
                modelRadius

            ]

        },


        zaxis: {

            visible: false,

            showgrid: false,

            zeroline: false,

            showline: false,

            showticklabels: false,

            fixedrange: true,

            range: [

                modelCentre[2]
                -
                modelRadius,

                modelCentre[2]
                +
                modelRadius

            ]

        },


        aspectmode: "cube",


        /*
           Disable native Plotly dragging.
        */

        dragmode: false,


        camera:
            getCamera(),


        bgcolor: "#ffffff"

    };

}


/* ==========================================================
   PLOT LAYOUT
========================================================== */

function createPlotLayout() {

    return {

        autosize: true,


        margin: {

            l: 0,

            r: 0,

            t: 0,

            b: 0,

            pad: 0

        },


        paper_bgcolor:
            "#ffffff",


        plot_bgcolor:
            "#ffffff",


        showlegend:
            false,


        hovermode:
            false,


        scene:
            createScene(),


        uirevision:
            "dkv-fixed-scene"

    };

}


/* ==========================================================
   PLOT CONFIGURATION
========================================================== */

function createPlotConfig() {

    return {

        responsive: true,


        displayModeBar: false,


        displaylogo: false,


        /*
           Native Plotly wheel zoom disabled.
           Custom zoom controller handles it.
        */

        scrollZoom: false,


        doubleClick: false,


        showTips: false

    };

}


/* ==========================================================
   RENDER STAGE
========================================================== */

async function renderStage() {

    const traces =
        buildStageTraces();


    const layout =
        createPlotLayout();


    const config =
        createPlotConfig();


    await Plotly.react(

        plotElement,

        traces,

        layout,

        config

    );


    /*
       Restore current custom camera after every redraw.
    */

    applyCamera();


    updateInterface();

}


/* ==========================================================
   UPDATE INTERFACE
========================================================== */

function updateInterface() {

    const stage =
        STAGES[
            currentStage
        ];


    stepLabel.textContent =
        `STEP ${currentStage + 1} OF ${STAGES.length}`;


    stageTitle.textContent =
        stage.title;


    stageSubtitle.textContent =
        stage.subtitle;


    stageDescription.textContent =
        stage.description;


    updateProgressBar();


    /* ------------------------------------------------------
       RESULT CARD
    ------------------------------------------------------ */

    if (
        currentStage ===
        STAGES.length - 1
    ) {

        const angle =
            geometryData
                .dkv_geometry
                .dkv_angle_degrees;


        resultValue.textContent =
            `${angle.toFixed(2)}°`;


        resultCard.classList.remove(
            "hidden"
        );

    } else {

        resultCard.classList.add(
            "hidden"
        );

    }


    /* ------------------------------------------------------
       BACK
    ------------------------------------------------------ */

    backButton.disabled =
        currentStage === 0;


    /* ------------------------------------------------------
       NEXT
    ------------------------------------------------------ */

    if (
        currentStage ===
        STAGES.length - 1
    ) {

        nextButton.disabled =
            true;


        nextButton.textContent =
            "Complete";

    } else {

        nextButton.disabled =
            false;


        nextButton.textContent =
            "Next →";

    }

}


/* ==========================================================
   NEXT
========================================================== */

async function nextStage() {

    if (
        currentStage >=
        STAGES.length - 1
    ) {

        return;

    }


    currentStage += 1;


    await renderStage();

}


/* ==========================================================
   BACK
========================================================== */

async function previousStage() {

    if (
        currentStage <= 0
    ) {

        return;

    }


    currentStage -= 1;


    await renderStage();

}


/* ==========================================================
   RESET VIEW
========================================================== */

function resetView() {

    cameraAzimuth =
        INITIAL_AZIMUTH_DEG;


    cameraElevation =
        INITIAL_ELEVATION_DEG;


    cameraDistance =
        INITIAL_CAMERA_DISTANCE;


    applyCamera();

}


/* ==========================================================
   BUTTON / WINDOW EVENTS
========================================================== */

function attachEventListeners() {

    backButton.addEventListener(

        "click",

        previousStage

    );


    nextButton.addEventListener(

        "click",

        nextStage

    );


    resetViewButton.addEventListener(

        "click",

        resetView

    );


    window.addEventListener(

        "resize",

        () => {

            Plotly.Plots.resize(
                plotElement
            );

        }

    );

}


/* ==========================================================
   START
========================================================== */

initialiseApp();