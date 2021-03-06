'use strict';

var $ = require('jquery');
var d3 = require('d3');
var osd = require('./lib/openseadragon');
var manifestLayout = require('./manifestLayout');
var canvasLayout = require('./canvasLayout');
var iiif = require('./iiifUtils');

var manifestor = function(options) {
    var manifest = options.manifest,
        sequence = options.sequence,
        canvases = options.sequence ? options.sequence.canvases : manifest.sequences[0].canvases,
        container = options.container,
        viewingDirection = options.viewingDirection ? options.viewingDirection : getViewingDirection(),
        viewingMode = options.viewingMode ? options.viewingHint : getViewingHint(),
        perspective = options.perspective ? options.perspective : 'overview',
        selectedCanvas = options.selectedCanvas,
        viewer,
        _canvasState,
        _canvasImageStates;

    function getViewingDirection() {
        if (sequence && sequence.viewingDirection) {
            return sequence.viewingDirection;
        }
        return manifest.viewingDirection ? manifest.viewingDirection : 'left-to-right';
    };

    function getViewingHint() {
        if (sequence && sequence.viewingHint) {
            return sequence.viewingHint;
        }
        return manifest.viewingHint ? manifest.viewingHint : 'individuals';
    };

    buildCanvasStates(canvases);

    var overlays = $('<div class="overlaysContainer">').css(
        {'width': '100%',
         'height': '100%',
         'position': 'absolute',
         'top': 0,
         'left': 0
        });
    var osdContainer = $('<div class="osd-container">').css(
        {'width': '100%',
         'height': '100%',
         'position': 'absolute',
         'top': 0,
         'left': 0
        });
    container.append(osdContainer);
    container.append(overlays);

    initOSD();
    canvasState({
        selectedCanvas: null, // @id of the canvas:
        focus: 'overview', // can be 'overview' or 'detail'
        viewingMode: 'single' // manifest derived or user specified (iiif viewingHint)
    });

    function render() {
        var layoutData = getData();

        renderManifest(layoutData);
        renderOSD(layoutData);
    }

    function canvasState(state) {

        if (!arguments.length) return _canvasState;
        _canvasState = state;

        // if (!initial) {
        //     jQuery.publish('annotationsTabStateUpdated' + this.windowId, this.tabState);
        // }

        render();

        return _canvasState;
    }

    function getData() {
        var userState = canvasState();

        // Layout is configured from current user state. The
        // layout algorithm, viewing hints, animations (such as
        // initial layout without animation) are all
        // functions of the current user state.
        var viewingDirection = userState.viewingDirection,
            viewingMode = userState.viewingMode,
            perspective = userState.perspective,
            selectedCanvas = userState.selectedCanvas;



        switch (viewingDirection) {
        case 'left-to-right':

            break;
        case 'right-to-left':
            break;
        case 'top-to-bottom':
            break;
        default: // the viewingDirection is bottom to top.
            break;
        }

        var layoutData = manifestLayout({
            canvases: canvases,
            width: container.width(),
            height: container.height(),
            viewingDirection: userState.viewingd,
            frameHeight: 100,
            frameWidth: 100,
            selectedCanvas: userState.selectedCanvas,
            vantagePadding: {
                top: 10,
                bottom: 40,
                left: 10,
                right: 10
            },
            containerPadding: {
                top: 50,
                bottom: 130,
                left: 10,
                right: 10
            }
        });

        var homeConstraints = ''; // The constraint bounds to use.
        var eventBinding = ''; // The set of events that are valid on the canvas.

        return layoutData;
    }

    function canvasImageStates(state) {

        if (!arguments.length) return _canvasImageStates;
        _canvasImageStates = state;

        // if (!initial) {
        //     jQuery.publish('annotationsTabStateUpdated' + this.windowId, this.tabState);
        // }

        return _canvasImageStates;
    }

    function renderManifest(layoutData) {
        // To understand this layout, read: http://bost.ocks.org/mike/nest/
        var interactionOverlay = d3.select(overlays[0])
                .attr('class', function(d) {
                    return 'overlaysContainer ' + canvasState().focus === 'detail' ? 'zoomed' : '';
                });
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
                })
                .tween('translateTilesources', translateTilesources)
                .each(updateImages);

        vantageUpdated.select('.frame')
            .attr('class', function(d) {
                var selected = d.frame.selected;
                return selected ? 'frame selected' : 'frame';
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
            .attr('class', function(d) {
                var selected = d.frame.selected;
                return selected ? 'frame selected' : 'frame';
            })
            .attr('data-id', function(d) {
                return d.frame.id;
            })
            .style('width', function(d) { return d.frame.width + 'px'; })
            .style('height', function(d) { return d.frame.height + 'px'; })
            .style('transform', function(d) { return 'translateX(' + d.frame.localX + 'px) translateY(' + d.frame.localY + 'px)'; })
            .each(enterImages);
        // .append('img')
        // .attr('src', function(d) { return d.frame.iiifService + '/full/' + Math.ceil(d.frame.width * 2) + ',/0/default.jpg';});

        vantageEnter
            .append('h4').text(function(d) { return d.frame.label; });
    };

    function translateTilesources(d, i) {
        var canvasId = d.frame.id,
            dummyObj = canvasImageStates()[canvasId].dummyObj;

        var currentBounds = dummyObj.getBounds(true),
            xi = d3.interpolate(currentBounds.x, d.frame.x),
            yi = d3.interpolate(currentBounds.y, d.frame.y);

        return function(t) {
            dummyObj.setPosition(new OpenSeadragon.Point(xi(t), yi(t)), true);
            viewer.forceRedraw();
            viewer.drawNow();
        };
    }

    function updateImages(d) {
        var frameData = d.frame,
            canvasImageState = canvasImageStates()[frameData.id];

        if (canvasState().focus === 'detail' && canvasState().selectedCanvas === frameData.id) {
            substitute(frameData, canvasImageState.dummyObj, canvasImageState.tileSourceUrl);
        }
    }

    function substitute(frameData, dummyObj, tileSourceUrl) {
        viewer.addTiledImage({
            x: frameData.x,
            y: frameData.y,
            width: frameData.width,
            tileSource: tileSourceUrl,
            index: 0, // Add the new image below the stand-in.
            success: function(event) {
                var fullImage = event.item;

                // The changeover will look better if we wait for the first tile to be drawn.
                var tileDrawnHandler = function(event) {
                    if (event.tiledImage === fullImage) {
                        viewer.removeHandler('tile-drawn', tileDrawnHandler);
                        fade(dummyObj, 0, function() { viewer.world.removeItem(dummyObj); });
                    }
                };

                viewer.addHandler('tile-drawn', tileDrawnHandler);
            }
        });
    }

    function enterImages(d) {

        var frameData = d.frame,
            canvasImageState = canvasImageStates()[frameData.id];

        var dummy = {
            type: 'legacy-image-pyramid',
            levels: [
                {
                    url: frameData.thumbService + '/full/' + Math.ceil(d.frame.width * 2) + ',/0/default.jpg',
                    width: frameData.width,
                    height: frameData.height
                }
            ]
        };

        viewer.addTiledImage({
            tileSource: dummy,
            x: frameData.x,
            y: frameData.y,
            width: frameData.width,
            success: function(event) {
                addDummyObj(frameData.id, event.item);
            }
        });

        if (canvasState().focus === 'detail' && canvasState().selectedCanvas === frameData.id) {
            substitute(frameData, canvasImageState.dummyObj, canvasImageState.tileSourceUrl);
        }
    }

    function fade(image, targetOpacity, callback) {
        var currentOpacity = image.getOpacity();
        var step = (targetOpacity - currentOpacity) / 10;
        if (step === 0) {
            callback();
            return;
        }

        var frame = function() {
            currentOpacity += step;
            if ((step > 0 && currentOpacity >= targetOpacity) || (step < 0 && currentOpacity <= targetOpacity)) {
                image.setOpacity(targetOpacity);
                callback();
                return;
            }

            image.setOpacity(currentOpacity);
            OpenSeadragon.requestAnimationFrame(frame);
        };
        OpenSeadragon.requestAnimationFrame(frame);
    };


    function removeImages(d) {
    }

    function renderOSD(layoutData) {
        var viewBounds =  layoutData.filter(function(vantage){
            return vantage.frame.selected;
        });

        if (viewBounds.length !== 0 && canvasState().focus === 'detail') {
            viewBounds = new OpenSeadragon.Rect(
                viewBounds[0].frame.x,
                viewBounds[0].frame.y,
                viewBounds[0].frame.width,
                viewBounds[0].frame.height
            );
        } else {
            viewBounds = new OpenSeadragon.Rect(0,0, container.width(), container.height());
        }

        viewer.viewport.fitBounds(viewBounds,false);
    };

    function initOSD() {
        viewer = OpenSeadragon({
            element: osdContainer[0],
            showNavigationControl: false
        });

        viewer.addHandler('animation', function(event) {
            synchroniseZoom();
        });
    };

    function synchroniseZoom() {
        var viewerWidth = viewer.container.clientWidth;
        var viewerHeight = viewer.container.clientHeight;
        var center = viewer.viewport.getCenter(true);
        var p = center.minus(new OpenSeadragon.Point(viewerWidth / 2, viewerHeight / 2));
        var zoom = viewer.viewport.getZoom(true);
        var scale = viewerWidth * zoom;

        var transform = 'scale(' + scale + ') translate(' + -p.x + 'px,' + -p.y + 'px)';

        d3.select(overlays[0])
            .style('transform', transform)
            .style('-webkit-transform', transform);
    }

    function selectCanvas(item) {
        var state = canvasState();
        state.selectedCanvas = item;
        state.focus = 'detail';

        canvasState(state);
    }

    function addImageCluster(id) {
        var canvases = canvasImageStates();

        canvases[id] = {
        };
    }

    function addDummyObj(id, osdTileObj) {
        var canvasStates = canvasImageStates();

        canvasStates[id].dummyObj = osdTileObj;

        canvasImageStates(canvasStates);
    }

    function buildCanvasStates(canvases) {
        var canvasStates = {};

        canvases.forEach(function(canvas) {
            console.log(canvas);
            canvasStates[canvas['@id']] = {
                tileSourceUrl: canvas.images[0].resource.service['@id'] + '/info.json'
            };
        });

        canvasImageStates(canvasStates);
    }

    function resize() {
        render();
    }

    container.on('click', '.frame', function(event) {
        selectCanvas($(this).data('id'));
    });

    return {
        //        selectMode: selectMode,
        // selectPerspective: selectPerspective,
        // next: next,
        // previous: previous,
        // scrollThumbs: scrollThumbs,
        resize: resize,
        selectCanvas: selectCanvas
        // hoverCanvas: hoverCanvas
    };

};
module.exports = manifestor;
