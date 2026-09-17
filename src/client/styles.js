    function ensureCss() {
      if (typeof document === 'undefined') return
      if (document.getElementById('drw-clinebot-full-css')) return
      const style = document.createElement('style')
      style.id = 'drw-clinebot-full-css'
      style.dataset.dshPlugin = NS
      style.textContent = `
.drw-page{display:flex;flex-direction:column;gap:18px;padding:6px 0 24px;max-width:960px}
.drw-header{display:flex;flex-direction:column;gap:8px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.drw-header-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.drw-page-title{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:10px}
.drw-page-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.drw-header-badges{display:flex;flex-wrap:wrap;gap:8px;align-items:center}

.drw-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:14px;list-style:none}
.drw-card-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between}
.drw-card-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-6px;line-height:1.4}

.drw-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.drw-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px}
.drw-grid-4{display:grid;grid-template-columns:repeat(auto-fit, minmax(190px, 1fr));gap:10px}

.drw-badge{font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:5px;font-weight:500;font-family:monospace}
.drw-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-bg, var(--dsw-alias-bg-layer-2))}
.drw-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:var(--dsw-alias-state-warning-bg, var(--dsw-alias-bg-layer-2))}
.drw-badge-err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-bg, var(--dsw-alias-bg-layer-2))}

.drw-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;width:100%;box-sizing:border-box}
.drw-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary)}
.drw-label{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);margin-bottom:2px}
.drw-hint{font-size:11px;color:var(--dsw-alias-label-dimmed, var(--dsw-alias-label-secondary));line-height:1.3}
.drw-field{display:flex;flex-direction:column;gap:3px;flex:1;min-width:180px}

.drw-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.drw-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-label-dimmed, var(--dsw-alias-border-l2))}
.drw-btn:disabled{opacity:0.6;cursor:not-allowed}
.drw-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.drw-btn-primary:hover:not(:disabled){opacity:0.9}
.drw-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-border, var(--dsw-alias-border-l2))}
.drw-btn-danger:hover:not(:disabled){background:var(--dsw-alias-state-error-bg, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-state-error-border, var(--dsw-alias-border-l2))}

.drw-segmented{display:inline-flex;border-radius:8px;padding:2px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);gap:2px}
.drw-segmented-item{appearance:none;border:none;background:none;cursor:pointer;padding:5px 12px;font-size:12px;font-weight:500;border-radius:6px;color:var(--dsw-alias-label-secondary);transition:all .15s ease}
.drw-segmented-item-active{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);font-weight:600}

.drw-table{width:100%;border-collapse:collapse;margin-top:4px}
.drw-table th{text-align:left;font-size:12px;color:var(--dsw-alias-label-secondary);padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);font-weight:600}
.drw-table td{padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:13px;color:var(--dsw-alias-label-primary)}
.drw-table tr:hover{background:var(--dsw-alias-bg-layer-2)}

.drw-stat-box{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:3px}
.drw-stat-val{font-size:14px;font-weight:700;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drw-stat-lbl{font-size:11px;color:var(--dsw-alias-label-secondary)}
.drw-preview{padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;border:1px solid var(--dsw-alias-border-l2);line-height:1.4}

.drw-browser-modal{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:12px;display:flex;flex-direction:column;gap:8px;max-height:280px}
.drw-browser-list{overflow-y:auto;display:flex;flex-direction:column;gap:2px;max-height:190px;padding-right:4px}
.drw-browser-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;font-family:monospace}
.drw-browser-item:hover{background:var(--dsw-alias-bg-layer-3)}

.drw-tabs{display:flex;gap:6px;border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:10px;margin-bottom:14px;overflow-x:auto}
.drw-tab-btn{appearance:none;border:1px solid transparent;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease}
.drw-tab-btn:hover{background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-primary)}
.drw-tab-btn.active{background:var(--dsw-alias-bg-layer-4);border-color:var(--dsw-alias-state-brand-primary);color:var(--dsw-alias-state-brand-primary)}

.drw-term-window{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;display:flex;flex-direction:column;height:340px;overflow:hidden;box-shadow:0 4px 14px var(--dsw-alias-border-l1)}
.drw-term-header{background:var(--dsw-alias-bg-layer-2);padding:6px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;color:var(--dsw-alias-label-secondary);font-family:monospace}
.drw-term-body{flex:1;padding:10px 12px;overflow-y:auto;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12.5px;line-height:1.45;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-all}
.drw-term-footer{display:flex;background:var(--dsw-alias-bg-layer-2);border-top:1px solid var(--dsw-alias-border-l2);padding:6px}
.drw-term-input{flex:1;background:transparent;border:none;color:var(--dsw-alias-link-primary, var(--dsw-alias-label-primary));font-family:monospace;font-size:13px;padding:4px 8px;outline:none}

.drw-explorer-box{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:12px;display:flex;flex-direction:column;gap:10px}
.drw-explorer-nav{display:flex;align-items:center;gap:8px;font-family:monospace;font-size:12px;background:var(--dsw-alias-bg-layer-1);padding:6px 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2)}
.drw-file-list{display:flex;flex-direction:column;gap:3px;max-height:260px;overflow-y:auto}
.drw-file-row{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;font-family:monospace;transition:background .1s ease}
.drw-file-row:hover{background:var(--dsw-alias-bg-layer-3)}
.drw-file-meta{display:flex;align-items:center;gap:12px;color:var(--dsw-alias-label-secondary);font-size:11.5px}

.drw-modal-overlay{position:fixed;inset:0;background:var(--dsw-alias-mask, var(--dsw-alias-bg-layer-1));z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.drw-modal-dialog{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;width:100%;max-width:800px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 32px var(--dsw-alias-border-l1)}
.drw-modal-hdr{padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;justify-content:space-between;font-weight:600}
.drw-modal-body{flex:1;padding:12px 16px;overflow-y:auto}

.drw-health-bar{display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;padding:8px 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font-size:11.5px;font-family:monospace}
.drw-health-item{display:flex;flex-direction:column;gap:2px}
.drw-progress{height:6px;background:var(--dsw-alias-bg-layer-1);border-radius:3px;overflow:hidden}
.drw-progress-fill{height:100%;border-radius:3px;transition:width .2s ease}

.drw-container-row{display:grid;grid-template-columns:2fr 2fr 1.5fr 1.5fr auto;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12.5px;font-family:monospace}
.drw-container-row:hover{background:var(--dsw-alias-bg-layer-3)}

.drw-env-table{width:100%;border-collapse:collapse}
.drw-env-row{display:grid;grid-template-columns:220px 1fr 90px;gap:8px;padding:6px 0;align-items:center;border-bottom:1px solid var(--dsw-alias-border-l2)}
.drw-alert-badge{padding:4px 8px;border-radius:6px;font-size:11px;font-family:monospace;display:flex;align-items:center;gap:6px}
.drw-alert-critical{background:var(--dsw-alias-state-error-bg, var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-border, var(--dsw-alias-border-l2))}
.drw-alert-warning{background:var(--dsw-alias-state-warning-bg, var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-warning-primary);border:1px solid var(--dsw-alias-state-warning-border, var(--dsw-alias-border-l2))}


      `
      document.head.appendChild(style)
    }

