'use strict';

var $ = require('jquery');
var d3 = require('d3');
var osd = require('./openseadragon');
var manifestLayout = require('./manifestLayout');

var manifest,
    container,
    _canvasState;

$.get('http://purl.stanford.edu/fw090jw3474/iiif/manifest.json', function(data) {
    manifest = data;
    initOSD();
    canvasState({
        selectedItem: null, // @id of the canvas:
        overview: true, // or particular item
        viewingMode: 'single' // manifest derived or user specified (iiif viewingHint)
    });
});


var manifestStore = function() {
    // Event Handlers (receiving objects from)
    // action creation; no public setters allowed.

    function requestComplete() {
    }

    function requestPending() {
    }

    function sequenceAdded() {
    }

    function rangeAdded() {
    }

    function canvasAdded() {
    }

    function resourceAdded() {
    }

    return {
        registerForChange: registerForChange
    };
};

container = $('#d3-example');

function render() {
    renderManifest(manifest);
    renderOSD(manifest, 'left-to-right', viewer);
}

function canvasState(state) {

    if (!arguments.length) return _canvasState;
    _canvasState = state;

    // if (!initial) {
    //     jQuery.publish('annotationsTabStateUpdated' + this.windowId, this.tabState);
    // }

    render();
}

function getData() {
    var userState = canvasState();

    var layoutData = manifestLayout({
        canvases: manifest.sequences[0].canvases,
        width: container.width(),
        height: container.height(),
        viewingDirection: userState.viewingd || 'left-to-right',
        frameHeight: 100,
        frameWidth: 100,
        selectedCanvas: userState.selectedItem,
        vantagePadding: {
            top: 10,
            bottom: 40,
            left: 5,
            right: 5
        }
    });

    // console.log(layoutData);
    return layoutData;
}

function renderManifest() {
    var layoutData = getData();
    // To understand this layout, read: http://bost.ocks.org/mike/nest/
    var interactionOverlay = d3.select('#d3-example');
    var vantage = interactionOverlay.selectAll('.vantage')
            .data(layoutData);

    var vantageUpdated = vantage
            .style('width', function(d) { return d.width + 'px'; })
            .style('height', function(d) { return d.height + 'px'; })
            .transition()
            .duration(1100)
            .ease('cubic-out')
            .styleTween('transform', function(d) {
                return d3.interpolateString(this.style.transform, 'translate(' + d.x +'px,' + d.y + 'px)');
            })
            .styleTween('-webkit-transform', function(d) {
                return d3.interpolateString(this.style.transform, 'translate(' + d.x +'px,' + d.y + 'px)');
            });

    var vantageEnter = vantage
            .enter().append('div')
            .attr('class', 'vantage')
            .style('width', function(d) { return d.width + 'px'; })
            .style('height', function(d) { return d.height + 'px'; })
            .style('transform', function(d) { return 'translate(' + d.x + 'px,' + d.y + 'px)'; })
            .style('-webkit-transform', function(d) { return 'translate(' + d.x + 'px,' + d.y + 'px)'; });

    vantageEnter
        .append('div')
        .attr('class', 'frame')
        .attr('data-id', function(d) {
            return d.frame.id;
        })
        .classed('selected', function(d) {
            return d.frame.selected;
        })
        .style('width', function(d) { console.log(d); return d.frame.width + 'px'; })
        .style('height', function(d) { return d.frame.height + 'px'; })
        .style('transform', function(d) { return 'translateX(' + d.frame.localX + 'px) translateY(' + d.frame.localY + 'px)'; });
        // .append('img')
        // .attr('src', function(d) { return d.frame.iiifService + '/full/' + Math.ceil(d.frame.width * 2) + ',/0/default.jpg';});

    vantageEnter
        .append('h4').text(function(d) { return d.frame.label; });
};

var renderOSD = function() {
    var layoutData = getData();

    viewer.viewport.fitBounds( new OpenSeadragon.Rect(0,0, container.width(), container.height()), true);

    var interactionOverlay = d3.select('#d3-example');

    // To understand this layout, read: http://bost.ocks.org/mike/nest/
    var frame = interactionOverlay.selectAll('.frame');

    frame.each(function(d) {
        console.log(d);
        console.log('running');
        var frameData = d.frame;

        var dummy = {
            type: 'legacy-image-pyramid',
            levels: [
                {
                    url: frameData.iiifService + '/full/' + Math.ceil(d.frame.width * 2) + ',/0/default.jpg',
                    width: frameData.width,
                    height: frameData.height
                }
            ]
        };

        viewer.addTiledImage({
            tileSource: dummy,
            x: frameData.x,
            y: frameData.y,
            width: frameData.width
        });
    });

    console.log(layoutData);
};

var initOSD = function() {
    window.viewer = OpenSeadragon({
        id: "osd-container",
        autoResize:true,
        showNavigationControl: false,
        preserveViewport: true
    });
};

var actions = [
    'pan',
    'zoom',
    'changePage',
    'next',
    'previous',
    'scrollThumbs',
    'hoverCanvas',
    'selectMode',
    'windowResize',
    'elementResize',
    'requestTilesource',
    'tileSourceFinishedLoading'
];

function selectItem(item) {
    var state = canvasState();
    state.selectedItem = item;

    canvasState(state);
}

$(window).on('resize', function() {
    renderManifest(manifest, $('readingDirection').val());
});

$('#readingDirection').on('change', function() {
    renderManifest(manifest, $(this).val());
    renderOSD(manifest, 'left-to-right', viewer);
});

$('.frame').on('click', function(event) {
    selectItem($(this).data('id'));
});

$('#scale').on('input', function() {
    renderManifest(manifest, $(this).val());
});
