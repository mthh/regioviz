import centroid from '@turf/centroid';
import bbox from '@turf/bbox';
import { app } from './../main';
import {
  color_disabled, color_countries, color_sup, color_inf, color_highlight,
  fixed_dimension, color_default_dissim, color_q1, color_q2, color_q3, color_q4,
} from './options';
import { math_max, getSvgPathType, svgPathToCoords, euclidian_distance, getElementsFromPoint, svgContextMenu, isContextMenuDisplayed } from './helpers';
import { filterLevelGeom } from './prepare-data';
import { prepareTooltip } from './tooltip';


const svg_map = d3.select('svg#svg_map')
  .on('contextmenu', () => {
    let selec;
    const _id = app.chart._id.toString();
    if (_id.indexOf('BarChart1') > -1 || _id.indexOf('ScatterPlot2')) {
      selec = Object.keys(app.colors);
    } else if (_id.indexOf('Similarity1plus') > -1 && app.chart.type === 'global') {
      selec = app.chart.highlighted;
    }
    svgContextMenu(app.map, svg_map, selec);
  });
let width_map;
let height_map;
let styles;
let projection;
let path;

function get_bbox_layer_path(name) {
  const bbox_layer = [[Infinity, Infinity], [-Infinity, -Infinity]];
  svg_map.select(`#${name}`)
    .selectAll('path')
    .each((d) => {
      const bbox_path = path.bounds(d.geometry);
      bbox_layer[0][0] = bbox_path[0][0] < bbox_layer[0][0] ? bbox_path[0][0] : bbox_layer[0][0];
      bbox_layer[0][1] = bbox_path[0][1] < bbox_layer[0][1] ? bbox_path[0][1] : bbox_layer[0][1];
      bbox_layer[1][0] = bbox_path[1][0] > bbox_layer[1][0] ? bbox_path[1][0] : bbox_layer[1][0];
      bbox_layer[1][1] = bbox_path[1][1] > bbox_layer[1][1] ? bbox_path[1][1] : bbox_layer[1][1];
    });
  return bbox_layer;
}

function fitLayer(background_layer) {
  projection.scale(1).translate([0, 0]);
  const b = get_bbox_layer_path(background_layer);
  const s = 1 / math_max((b[1][0] - b[0][0]) / width_map, (b[1][1] - b[0][1]) / height_map);
  const t = [(width_map - s * (b[1][0] + b[0][0])) / 2, (height_map - s * (b[1][1] + b[0][1])) / 2];
  projection.scale(s).translate(t);
  svg_map.selectAll('path').attr('d', path);
}

function map_zoomed() {
  const transform = d3.event
    ? d3.event.transform
    : !!svg_map.node().__zoom
      ? d3.zoomTransform(svg_map.node()) : d3.zoomIdentity;
  if (transform.k < 1) transform.k = 1;
  if (transform.k === 1) {
    transform.x = 0;
    transform.y = 0;
  }

  // const layers = svg_map.select('#layers');
  const t = svg_map
    .selectAll('g')
    .transition()
    .duration(125);

  svg_map.select('#layers')
    .selectAll('g')
    .transition(t)
    .attr('transform', transform)
    .style('stroke-width', function () {
      const a = styles.find(d => d.id === this.id);
      return a ?
        `${a['stroke-width'] / transform.k}px`
        : null;
    });

  svg_map.select('.brush_map')
    .transition(t)
    .attr('transform', transform);
}

function interpolateZoom(translate, scale) {
  const node_svg_map = svg_map.node();
  const transform = d3.zoomTransform(node_svg_map);
  return d3.transition().duration(125).tween('zoom', () => {
    const iTranslate = d3.interpolate([transform.x, transform.y], translate);
    const iScale = d3.interpolate(transform.k, scale);
    return (t_value) => {
      node_svg_map.__zoom.k = iScale(t_value);
      const _t = iTranslate(t_value);
      node_svg_map.__zoom.x = _t[0];
      node_svg_map.__zoom.y = _t[1];
      map_zoomed();
    };
  });
}

function zoomClick() {
  const direction = (this.id === 'zoom_in') ? 1 : -1;
  const factor = 0.1;
  const center = [width_map / 2, height_map / 2];
  const transform = d3.zoomTransform(svg_map.node());
  const view = { x: transform.x, y: transform.y, k: transform.k };
  d3.event.preventDefault();
  const translate0 = [(center[0] - view.x) / view.k, (center[1] - view.y) / view.k];
  view.k = transform.k * (1 + factor * direction);
  const l = [translate0[0] * view.k + view.x, translate0[1] * view.k + view.y];
  view.x += center[0] - l[0];
  view.y += center[1] - l[1];
  interpolateZoom([view.x, view.y], view.k);
}


function makeMapLegend(legend_elems, size, translateY) {
  const rect_size = 15;
  const spacing = 4;
  const lgd_height = rect_size + spacing;
  const offset = lgd_height * legend_elems.length / 2;

  const width_value_map = document.getElementById('map_section').getBoundingClientRect().width * 0.98;
  d3.select('.cont_svg.clgd')
    .style('padding-top', `${(size / fixed_dimension.legend.width) * width_value_map}px`);

  const grp_lgd = d3.select('#svg_legend')
    .attr('viewBox', `0 0 ${fixed_dimension.legend.width} ${size}`)
    .append('g')
    .styles({ 'font-size': '14px', 'font-family': '\'Signika\', sans-serif' });

  const legends = grp_lgd.selectAll('.legend')
    .data(legend_elems)
    .enter()
    .append('g')
    .attr('class', 'legend')
    .attr('transform', (d, i) => `translate(${[10, +translateY + i * lgd_height - offset]})`);

  legends.append('rect')
    .attrs({ width: rect_size, height: rect_size })
    .styles(d => ({ fill: d.color, stroke: d.color }));

  legends.append('text')
    .attrs({ x: rect_size + spacing, y: rect_size - spacing })
    .text(d => d.text);

  if (legend_elems[legend_elems.length - 1].color instanceof Array) {
    const elems = grp_lgd.selectAll('g.legend')._groups[0];
    const last_elem = d3.select(elems[elems.length - 1]);
    last_elem.append('polygon')
      .attr('points', `0,0 ${rect_size},${rect_size} 0,${rect_size}`)
      .style('fill', last_elem.node().__data__.color[0]);
    last_elem.append('polygon')
      .attr('points', `0,0 ${rect_size},0 ${rect_size},${rect_size}`)
      .style('fill', last_elem.node().__data__.color[1]);
  }
}

function getLegendElems(type) {
  if (type === 0) {
    return [
      [
        { color: color_highlight, text: `Mon territoire : ${app.current_config.my_region_pretty_name}` },
        { color: color_countries, text: 'Autres territoires de l\'espace d\'étude' },
        { color: color_sup, text: 'Rang plus élevé que mon territoire' },
        { color: color_inf, text: 'Rang moins élevé que mon territoire' },
      ],
      '80', '41',
    ];
  } else if (type === 1) {
    return [
      [
        { color: color_highlight, text: `Mon territoire : ${app.current_config.my_region_pretty_name}` },
        { color: color_countries, text: 'Autres territoires de l\'espace d\'étude' },
        { color: color_sup, text: 'Rang plus élevé que mon territoire (2 indicateurs)' },
        { color: color_inf, text: 'Rang moins élevé que mon territoire (2 indicateurs)' },
        { color: ['orange', 'rgb(160, 30, 160)'], text: 'Rang plus élevé que mon territoire (1 indicateur sur 2)' },
      ],
      '100', '50',
    ];
  } else if (type === 4) {
    return [
      [
        { color: color_highlight, text: `Mon territoire : ${app.current_config.my_region_pretty_name}` },
        { color: color_default_dissim, text: 'Territoire le plus ressemblant' },
        { color: color_q1, text: 'Territoires très ressemblants' },
        { color: color_q2, text: 'Territoires ressemblants' },
        { color: color_q3, text: 'Territoires dissemblants' },
        { color: color_q4, text: 'Territoires très dissemblants' },
      ],
      '120', '60',
    ];
  }
  return [
    [
      { color: color_highlight, text: `Mon territoire : ${app.current_config.my_region_pretty_name}` },
      { color: color_countries, text: 'Autres territoires de l\'espace d\'étude (sélectionnables)' },
    ],
    '50', '22.5',
  ];
}


class MapSelect {
  constructor(territ_layer, other_layers, user_styles, filter = 'N1') {
    styles = [].concat(user_styles);

    const background_layer = {
      id: styles[0].id,
      name: styles[0].name,
    };
    // Bounding box of background/larger layer (as [minX, minY, maxX, maxY]):
    const bbox_background = bbox(other_layers.get(background_layer.name));
    const width_bg = bbox_background[2] - bbox_background[0];
    const height_bg = bbox_background[3] - bbox_background[1];
    fixed_dimension.map.height = Math.round((470 * height_bg) / width_bg);
    width_map = fixed_dimension.map.width;
    height_map = fixed_dimension.map.height;
    svg_map.attr('viewBox', `0 0 ${width_map} ${height_map}`);

    const width_value = document.getElementById('map_section').getBoundingClientRect().width * 0.98;
    d3.select('.cont_svg.cmap')
      .style('padding-top', `${(height_map / width_map) * width_value}px`);

    svg_map.append('defs')
      .append('svg:clipPath')
      .attr('id', 'clip_map')
      .append('svg:rect')
      .attrs({
        width: width_map,
        height: height_map,
        x: 0,
        y: 0,
      });
    projection = d3.geoIdentity()
      .fitExtent(
        [[0, 0], [width_map, height_map]],
        other_layers.get(background_layer.name),
      )
      .reflectY(true);

    path = d3.geoPath().projection(projection);

    const layers = svg_map.append('g')
      .attrs({
        id: 'layers',
        transform: 'scale(1)',
        'clip-path': 'url(#clip_map)',
      });
    this.territ_layer = territ_layer;
    this.zoom_map = d3.zoom()
      .scaleExtent([1, 6])
      .translateExtent([[0, 0], [width_map, height_map]])
      .on('zoom', map_zoomed);

    svg_map.call(this.zoom_map);

    const fn_attrs_target_layer = d => ({
      class: 'tg_ft',
      title: `${d.properties[app.current_config.name_field]} (${d.id})`,
      fill: (d.id !== app.current_config.my_region ? color_countries : color_highlight),
      d: path,
    });

    const fn_attrs_layers = d => (d.properties.name
      ? { d: path, class: 'tg_ft', title: d.properties.name }
      : { d: path });
    // const layer_list = styles.map(d => d.id);
    for (let i = 0, n_layer = styles.length; i < n_layer; i++) {
      const name_lyr = styles[i].name;
      if (styles[i].target === 'true') {
        this.target_layer = layers.append('g')
          .attrs(styles[i]);
        this.target_layer.selectAll('path')
          .data(filterLevelGeom(this.territ_layer.features, filter), d => d.id)
          .enter()
          .append('path')
          .attrs(fn_attrs_target_layer);
      } else {
        layers.append('g')
          .attrs(styles[i])
          .selectAll('path')
          .data(other_layers.get(name_lyr).features)
          .enter()
          .append('path')
          .attrs(fn_attrs_layers);
      }
    }
    layers.append('g')
      .attrs({ id: 'temp' });

    this.layers = layers;
    fitLayer(background_layer.id);
    app.type_path = getSvgPathType(this.target_layer.select('path').node().getAttribute('d'));
    this.target_layer.selectAll('path')
      .each(function () {
        this._pts = svgPathToCoords(this.getAttribute('d'), app.type_path);
      });
    this.tooltip = prepareTooltip(d3.select(svg_map.node().parentNode), null, 'tooltip_map');
    this.bindTooltips();
    this.brushToTooltip();
  }

  updateLevelRegion(filter = 'N1') {
    const new_selection = filterLevelGeom(this.territ_layer.features, filter);
    const selection = this.target_layer
      .selectAll('path')
      .data(new_selection, d => d.id);
    selection.enter()
      .append('path')
      .attrs(d => ({
        class: 'tg_ft',
        title: `${d.properties[app.current_config.name_field]} (${d.id})`,
        fill: d.id !== app.current_config.my_region ? color_countries : color_highlight,
        d: path,
      }));
    selection
      .attrs(d => ({
        class: 'tg_ft',
        title: `${d.properties[app.current_config.name_field]} (${d.id})`,
        fill: d.id !== app.current_config.my_region ? color_countries : color_highlight,
        d: path,
      }));
    selection
      .exit()
      .remove();
    this.resetColors(new_selection.map(d => d.id));
    this.computeDistMat();
    this.target_layer.selectAll('path')
      .each(function () {
        this._pts = undefined;
      });
    this.bindTooltips();
    this.brushToTooltip();
  }

  bindTooltips() {
    const self = this;
    this.layers.selectAll('path[title]')
      // .on('mouseover', () => {
      //   // clearTimeout(t);
      //   this.tooltip.style('display', null);
      // })
      .on('mouseout', () => {
        // clearTimeout(t);
        // t = setTimeout(() => {
        this.tooltip.style('display', 'none');
      // }, 250);
      })
      .on('mouseover mousemove mousedown', function () {
        // clearTimeout(t);
        if (isContextMenuDisplayed()) return;
        self.tooltip.select('.title').html(this.getAttribute('title'));
        const b = self.tooltip.select('.title').node().getBoundingClientRect();
        const left = d3.event.clientX < (window.innerWidth - (b.width + 20))
          ? d3.event.clientX - 5
          : d3.event.clientX - b.width;
        self.tooltip
          .styles({
            display: null,
            left: `${left}px`,
            top: `${d3.event.clientY - b.height - 20}px`,
          });
      });
  }

  resetColors(current_ids) {
    this.target_layer.selectAll('path')
      .attr('fill', (d) => {
        if (d.id === app.current_config.my_region) {
          return color_highlight;
        } else if (current_ids.indexOf(d.id) > -1) {
          return app.colors[d.id] || color_countries;
        }
        return color_disabled;
      });
  }

  // eslint-disable-next-line class-methods-use-this
  resetZoom() {
    d3.zoomIdentity.x = 0;
    d3.zoomIdentity.y = 0;
    d3.zoomIdentity.k = 1;
    svg_map.node().__zoom = d3.zoomIdentity;
    // svg_map.node().__zoom.x = 0;
    // svg_map.node().__zoom.y = 0;
    svg_map.call(this.zoom_map.transform, d3.zoomIdentity);
  }

  // eslint-disable-next-line class-methods-use-this
  updateLegend() {
    d3.select('#svg_legend > g > .legend > text')
      .text(`Mon territoire : ${app.current_config.my_region_pretty_name}`);
  }

  removeRectBrush() {
    if (this.brush_map) {
      svg_map.select('.brush_map').call(this.brush_map.move, null);
    }
  }

  callBrush(selection) {
    if (this.brush_map) {
      svg_map.select('.brush_map').call(this.brush_map.move, selection);
    }
  }

  brushToTooltip() {
    const self = this;
    svg_map.select('.brush_map')
      .on('mousemove mousedown', () => {
        const elems = getElementsFromPoint(d3.event.clientX, d3.event.clientY);
        const elem = elems.find(e => e.className.baseVal === 'tg_ft');
        if (elem) {
          const new_click_event = new MouseEvent('mousemove', {
            pageX: d3.event.pageX,
            pageY: d3.event.pageY,
            clientX: d3.event.clientX,
            clientY: d3.event.clientY,
            bubbles: true,
            cancelable: true,
            view: window,
          });
          elem.dispatchEvent(new_click_event);
        } else {
          self.tooltip.style('display', 'none');
        }
      })
      .on('mouseout', () => {
        self.tooltip.style('display', 'none');
      });
  }

  bindBrushClick(chart) {
    // svg_map.on('.zoom', null);
    this.resetZoom();
    if (chart.handleClickMap) {
      document.getElementById('img_map_select').classList.remove('disabled');
      document.getElementById('img_map_select').classList.add('active');
    } else {
      document.getElementById('img_map_select').classList.add('disabled');
    }
    if (chart.handle_brush_map) {
      const self = this;
      document.getElementById('img_rect_selec').classList.remove('disabled');
      document.getElementById('img_rect_selec').classList.add('active');
      // document.getElementById('img_map_zoom').classList.remove('active');
      document.getElementById('img_map_select').classList.remove('active');
      this.brush_map = d3.brush()
        .extent([[0, 0], [width_map, height_map]])
        .on('start brush', () => {
          chart.handle_brush_map(d3.event);
        });
      svg_map.append('g')
        .attr('class', 'brush_map')
        .call(this.brush_map);
      self.bindTooltips();
      self.brushToTooltip();
    } else {
      document.getElementById('img_rect_selec').classList.remove('active');
      document.getElementById('img_rect_selec').classList.add('disabled');
      // document.getElementById('img_map_zoom').classList.remove('active');
      document.getElementById('img_map_select').classList.add('active');
    }
    if (chart.handleClickMap && !chart.handle_brush_map) {
      this.target_layer.selectAll('path')
        .on('click', function (d) {
          chart.handleClickMap(d, this);
        });
    }
  }

  getUnitsWithin(dist_km) {
    const dist = dist_km * 1000;
    if (!this.dist_to_my_region) this.computeDistMat();
    return this.dist_to_my_region.filter(d => d.dist <= dist).map(d => d.id);
  }

  getClosestUnit() {
    return this.dist_to_my_region[1];
  }

  computeDistMat() {
    const features = Array.prototype.slice
      .call(this.target_layer.node().querySelectorAll('path'));
    const nb_ft = features.length;
    const my_region_geom = features
      .find(d => d.__data__.id === app.current_config.my_region).__data__.geometry;
    const my_reg_centroid = centroid(my_region_geom);
    const result_dist = [];
    for (let i = 0; i < nb_ft; i++) {
      const id = features[i].__data__.id;
      const dist = euclidian_distance(my_reg_centroid, centroid(features[i].__data__.geometry));
      result_dist.push({ id, dist });
    }
    result_dist.sort((a, b) => a.dist - b.dist);
    this.dist_to_my_region = result_dist;
  }

  // eslint-disable-next-line class-methods-use-this
  isMap() {
    return true;
  }

  zoomOnFeature(ft_id) {
    const self = this;
    this.target_layer.selectAll('path')
      .each(function (d) {
        if (d.id === ft_id) {
          const cloned = this.cloneNode();
          self.layers.select('#temp').node().appendChild(cloned);
          const _cloned = d3.select(cloned);
          const ref_fill_value = _cloned.attr('fill');
          _cloned
            .attrs({
              class: 'cloned',
              fill: d3.color(ref_fill_value).brighter(0.75),
            })
            .styles({
              stroke: 'orange',
              'stroke-width': '1.25px',
            });

          const bounds = path.bounds(d);
          const dx = bounds[1][0] - bounds[0][0];
          const dy = bounds[1][1] - bounds[0][1];
          const x = (bounds[0][0] + bounds[1][0]) / 2;
          const y = (bounds[0][1] + bounds[1][1]) / 2;
          let scale = 0.9 / Math.max(dx / width_map, dy / height_map);
          if (scale > 5) scale = 5;
          const translate = [width_map / 2 - scale * x, height_map / 2 - scale * y];
          const layers = svg_map.select('#layers');
          const transf = `translate(${translate})scale(${scale})`;
          const t = d3.transition()
            .duration(125)
            .on('end', () => {
              const t2 = d3.transition()
                .duration(3000)
                .on('end', () => {
                  _cloned.remove();
                });
              _cloned.transition(t2)
                .attr('fill', ref_fill_value)
                .styles({ stroke: 'white', 'stroke-width': 0 });
            });

          layers.selectAll('g')
            .transition(t)
            .attr('transform', transf)
            .style('stroke-width', function () {
              const a = styles.find(ft => ft.id === this.id);
              return a ?
                `${a['stroke-width'] / scale}px`
                : null;
            });

          svg_map.select('.brush_map')
            .transition(t)
            .attr('transform', transf);
        }
      });
  }

  unbindBrushClick() {
    this.brush_map = null;
    svg_map.select('.brush_map').remove();
  }

  displayLegend(type = 0) { // eslint-disable-line class-methods-use-this
    d3.selectAll('#svg_legend > g').remove();
    const [elems, size, ty] = getLegendElems(type);
    makeMapLegend(elems, size, ty);
  }
}

export {
  MapSelect,
  makeMapLegend,
  svg_map,
  zoomClick,
};
