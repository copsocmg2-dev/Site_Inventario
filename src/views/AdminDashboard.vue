<template>
  <div class="flex h-screen overflow-hidden bg-slate-50 font-sans">
    <!-- Toasts -->
    <div class="fixed top-6 right-6 z-[200] flex flex-col gap-3 max-w-sm w-full">
      <div v-for="toast in toasts" :key="toast.id" 
           :class="['p-4 rounded-lg shadow-xl border-l-4 flex items-start gap-3 bg-white animate-in slide-in-from-right', 
                   toast.tipo === 'sucesso' ? 'border-green-500 text-green-800' : 'border-red-500 text-red-800']">
        <i :class="['ph text-2xl', toast.tipo === 'sucesso' ? 'ph-check-circle text-green-500' : 'ph-warning-circle text-red-500']"></i>
        <div class="flex-1 text-sm font-medium">{{ toast.mensagem }}</div>
      </div>
    </div>

    <!-- Sidebar -->
    <aside class="w-64 bg-[#113366] text-white flex flex-col shadow-lg z-10 transition-transform">
      <div class="p-6 border-b border-white/10 text-center">
        <h1 class="text-2xl font-bold flex flex-col items-center gap-1">
          <i class="ph ph-barcode text-[#ee4d2d] text-5xl"></i>
          <div>Ativos<span class="text-[#ee4d2d]">MG2</span></div>
        </h1>
        <p class="text-[10px] uppercase tracking-tighter opacity-50 font-bold">Coordenação Operacional</p>
      </div>
      <nav class="flex-1 px-4 py-6 space-y-1">
        <button v-for="tab in tabs" :key="tab.id" @click="currentTab = tab.id" :class="navClass(tab.id)">
          <i :class="['ph text-xl', tab.icon]"></i> 
          <span>{{ tab.label }}</span>
          <span v-if="(tab.id === 'solicitacoes' && badgeCounts.sol > 0) || (tab.id === 'solicitacoes' && badgeCounts.trc > 0)" 
                class="ml-auto bg-[#ee4d2d] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black shadow-sm">
            {{ badgeCounts.sol + badgeCounts.trc }}
          </span>
        </button>
      </nav>
      <div class="px-4 pb-4">
        <button @click="currentTab = 'config'" :class="navClass('config')">
          <i class="ph ph-gear text-xl"></i>
          <span>Configurações</span>
        </button>
      </div>
      <div class="p-4 border-t border-white/5 text-center text-[10px] text-white/30 italic">v3.0 Supabase Real-time</div>
    </aside>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto p-8 relative">
      <!-- Loader Overlay -->
      <div v-if="loading" class="fixed inset-0 bg-white/60 z-[100] flex flex-col items-center justify-center backdrop-blur-[1px]">
        <div class="w-12 h-12 border-4 border-slate-200 border-t-[#ee4d2d] rounded-full animate-spin mb-4"></div>
        <p class="text-[#113366] font-black text-sm animate-pulse tracking-widest uppercase">Processando...</p>
      </div>

      <!-- DASHBOARD TAB -->
      <div v-if="currentTab === 'dash'" class="space-y-6 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
        <div class="flex justify-between items-end bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h2 class="text-3xl font-black text-[#113366] flex items-center gap-2">
              <i class="ph-fill ph-chart-line text-[#ee4d2d]"></i> Visão Geral
            </h2>
            <p class="text-slate-400 text-sm font-medium">Monitoramento de ativos em tempo real.</p>
          </div>
          <button @click="fetchInitialData" :disabled="loading" class="bg-[#113366] text-white px-6 py-2.5 rounded-xl hover:bg-[#0c2447] flex items-center gap-2 shadow-lg transition-all font-bold group disabled:opacity-50">
            <i class="ph ph-arrows-clockwise text-xl group-hover:rotate-180 transition-transform duration-500"></i>
            Atualizar Agora
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="kpi in kpiCards" :key="kpi.label" @click="filtro.status = kpi.filterVal"
               :class="['p-6 rounded-2xl border flex items-center gap-5 cursor-pointer transition-all hover:-translate-y-1', filtro.status === kpi.filterVal ? kpi.activeClass : 'bg-white border-slate-200 hover:shadow-md']">
            <div :class="['p-4 rounded-xl', filtro.status === kpi.filterVal ? 'bg-white/20' : kpi.iconBg]">
              <i :class="['text-3xl', kpi.icon, filtro.status !== kpi.filterVal ? kpi.iconColor : '']"></i>
            </div>
            <div>
              <p class="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">{{ kpi.label }}</p>
              <p class="text-4xl font-black">{{ kpi.value }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
          <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-4 items-center justify-between rounded-t-2xl">
            <div class="relative w-full xl:w-1/3 group">
              <i class="ph ph-magnifying-glass absolute left-4 top-3.5 text-slate-400 text-lg group-focus-within:text-[#113366] transition-colors"></i>
              <input type="text" v-model="filtro.busca" placeholder="Filtrar por SN..." 
                     class="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-[#113366] focus:ring-4 focus:ring-blue-50 outline-none font-mono text-sm transition-all shadow-sm">
            </div>
            <div class="flex flex-wrap gap-2 w-full xl:w-auto xl:justify-end">
              <select v-model="filtro.status" class="px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-[#113366] outline-none text-sm font-bold text-slate-600 bg-white shadow-sm">
                <option value="">Status: Todos</option>
                <option value="Disponível">Disponível</option>
                <option value="Emprestado">Emprestado</option>
                <option value="Quebrado">Quebrado</option>
              </select>
            </div>
          </div>
          <div class="flex-1 overflow-auto custom-scrollbar font-mono">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="bg-white sticky top-0 shadow-sm z-10 border-b border-slate-100 font-sans">
                <tr>
                  <th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Serial Number</th>
                  <th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Modelo</th>
                  <th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                  <th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest w-1/4">Obs</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="item in estoqueFiltrado" :key="item.sn" class="hover:bg-blue-50/40 transition-colors">
                  <td class="px-6 py-4 font-bold text-[#113366] text-sm italic">{{ item.sn }}</td>
                  <td class="px-6 py-4 text-slate-600 font-sans font-semibold">{{ item.modelo }}</td>
                  <td class="px-6 py-4 font-sans">
                    <span v-if="item.status === 'Disponível'" class="bg-green-100 text-green-700 px-3 py-1 rounded-full font-black text-[10px] uppercase">Estoque</span>
                    <span v-if="item.status === 'Emprestado'" class="bg-orange-100 text-[#ee4d2d] px-3 py-1 rounded-full font-black text-[10px] uppercase">Em Campo</span>
                    <span v-if="item.status === 'Quebrado'" class="bg-red-100 text-red-700 px-3 py-1 rounded-full font-black text-[10px] uppercase">Avaria</span>
                  </td>
                  <td class="px-6 py-4 font-black text-slate-700 font-sans">{{ item.responsavel }}</td>
                  <td class="px-6 py-4 text-slate-400 italic font-sans">{{ item.observacao || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SOLICITAÇÕES TAB -->
      <div v-if="currentTab === 'solicitacoes'" class="space-y-6 max-w-4xl mx-auto animate-in slide-in-from-bottom-5 duration-300">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 class="text-3xl font-black text-[#113366] flex items-center gap-2">
            <i class="ph-fill ph-bell-ringing text-[#ee4d2d]"></i> Pedidos de Líderes
          </h2>
          <p class="text-slate-400 text-sm font-medium">Gerencie solicitações vindas pelo App Mobile.</p>
        </div>

        <div class="grid gap-4">
          <div v-for="sol in solicitacoes" :key="sol.id" 
               class="bg-white p-5 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-lg"
               :class="solStatusClass(sol.status)">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-[#113366] font-black text-xl shadow-inner border border-slate-100">
                {{ sol.lideres?.nome?.charAt(0) || '?' }}
              </div>
              <div>
                <h4 class="font-black text-[#113366]">{{ sol.lideres?.nome }}</h4>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{{ formatDate(sol.data) }}</p>
                <p v-if="sol.observacao" class="text-xs text-slate-500 mt-1 italic">"{{ sol.observacao }}"</p>
              </div>
            </div>
            <div class="flex flex-col md:items-end gap-3 text-right">
              <div class="text-3xl font-black text-[#ee4d2d]">{{ sol.quantidade }} <span class="text-xs text-slate-400 font-bold uppercase">PDAs</span></div>
              
              <div v-if="sol.status === 'PENDENTE'" class="flex gap-2">
                <button @click="handleActionSol(sol.id, 'REJEITADO')" class="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-50 hover:text-red-500 transition-all">REJEITAR</button>
                <button @click="handleActionSol(sol.id, 'APROVADO')" class="bg-[#113366] text-white px-6 py-2 rounded-xl text-xs font-black shadow-md hover:bg-[#0c2447]">APROVAR</button>
              </div>

              <button v-else-if="sol.status === 'APROVADO'" @click="openDeliveryModal(sol)"
                      class="bg-[#ee4d2d] text-white px-6 py-3 rounded-xl text-xs font-black shadow-lg shadow-brand-orange/30 hover:scale-105 transition-all flex items-center gap-2">
                <i class="ph-bold ph-barcode text-lg"></i> ENTREGAR AGORA
              </button>

              <div v-else class="flex items-center gap-2">
                <button @click="handleDeleteSol(sol.id)" class="bg-slate-50 text-slate-300 px-3 py-2 rounded-xl text-xs hover:text-red-500 transition-all border border-slate-100">
                  <i class="ph ph-trash"></i>
                </button>
                <span class="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                  {{ sol.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- SAÍDE MANUAL TAB -->
      <div v-if="currentTab === 'emprestimo'" class="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-300">
        <div class="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-8 relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1.5 bg-[#113366]"></div>
          <h3 class="text-2xl font-black text-[#113366] flex items-center gap-3">
            <i class="ph ph-hand-pointing text-[#ee4d2d]"></i> Saída Manual
          </h3>
          
          <div>
            <label class="text-[10px] font-black text-slate-400 mb-2 block tracking-widest uppercase">Responsável</label>
            <select v-model="formEmp.responsavelId" class="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl focus:border-[#113366] outline-none font-bold text-slate-600 bg-white shadow-sm">
              <option disabled value="">Selecione o Líder...</option>
              <option v-for="l in lideres" :key="l.id" :value="l.id">{{ l.nome }} ({{ l.areas?.nome }})</option>
            </select>
          </div>

          <div class="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
            <label class="text-[10px] font-black text-[#113366] mb-2 block tracking-widest uppercase">Bipar Scanner</label>
            <input type="text" v-model="formEmp.curSn" @keyup.enter="handleBiparManual" ref="inpEmp"
                   placeholder="Aponte o coletor..."
                   class="w-full px-5 py-4 border-2 border-brand-orange/30 rounded-2xl focus:border-[#ee4d2d] outline-none font-mono font-black text-xl text-center uppercase tracking-widest shadow-sm">
          </div>

          <div v-if="formEmp.sns.length" class="space-y-2">
            <div v-for="(sn, idx) in formEmp.sns" :key="idx" class="p-4 bg-white rounded-2xl border border-slate-100 flex justify-between items-center group shadow-sm transition-all hover:border-[#113366]">
              <span class="font-mono font-black text-[#113366] text-lg">{{ sn }}</span>
              <button @click="formEmp.sns.splice(idx,1)" class="text-slate-300 hover:text-red-500 transition-colors">
                <i class="ph-bold ph-trash"></i>
              </button>
            </div>
          </div>

          <button @click="handleRecordingLoan" :disabled="!formEmp.sns.length || !formEmp.responsavelId || loading"
                  class="w-full bg-[#113366] text-white py-5 rounded-2xl font-black shadow-xl shadow-brand-blue/20 hover:bg-[#0c2447] disabled:opacity-30 transition-all font-sans uppercase tracking-widest">
            Registrar Saída de {{ formEmp.sns.length }} Ativos
          </button>
        </div>
      </div>

      <!-- RETORNO TAB -->
      <div v-if="currentTab === 'devolucao'" class="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-300">
        <div class="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-8 relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1.5 bg-[#ee4d2d]"></div>
          <h3 class="text-2xl font-black text-[#113366] flex items-center gap-3">
            <i class="ph ph-arrow-u-up-left text-[#ee4d2d]"></i> Retorno de Ativos
          </h3>

          <div class="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 space-y-4">
            <div>
               <label class="text-[10px] font-black text-slate-400 mb-2 block tracking-widest uppercase">Quem está devolvendo?</label>
               <select v-model="formDev.responsavelId" class="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl focus:border-[#113366] outline-none font-bold text-slate-600 bg-white shadow-sm">
                 <option disabled value="">Selecione o Líder...</option>
                 <option v-for="l in lideres" :key="l.id" :value="l.id">{{ l.nome }} ({{ l.areas?.nome }})</option>
               </select>
            </div>
            <div>
               <label class="text-[10px] font-black text-[#ee4d2d] mb-2 block tracking-widest uppercase text-center mt-4">Bipar Scanner</label>
               <input type="text" v-model="formDev.curSn" @keyup.enter="handleBiparDev" ref="inpDev"
                      placeholder="Bipe para liberar..."
                      class="w-full px-5 py-4 border-2 border-brand-blue/30 rounded-2xl focus:border-[#113366] outline-none font-mono font-black text-xl text-center uppercase tracking-widest shadow-sm">
            </div>
          </div>

          <div v-if="formDev.list.length" class="space-y-3">
            <div v-for="(item, idx) in formDev.list" :key="idx" class="p-4 bg-white rounded-2xl border border-slate-100 space-y-3 shadow-sm">
              <div class="flex justify-between items-center font-mono font-black text-[#113366]">
                <div class="flex flex-col">
                  <span class="text-lg">{{ item.sn }}</span>
                  <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Responsável: {{ item.responsavel }}</span>
                </div>
                <button @click="formDev.list.splice(idx,1)" class="text-slate-300 hover:text-red-500"><i class="ph-bold ph-trash"></i></button>
              </div>
              <div class="flex gap-2 font-sans">
                <select v-model="item.condicao" class="px-3 py-2 rounded-xl text-xs font-black border-2 flex-1 outline-none"
                        :class="item.condicao==='OK'?'border-green-100 text-green-700':'border-red-100 text-red-700'">
                  <option value="OK">Condição: OK</option>
                  <option value="Quebrado">Avariado / Quebrado</option>
                </select>
                <input v-if="item.condicao==='Quebrado'" v-model="item.observacao" placeholder="Motivo da avaria..." 
                       class="flex-[2] px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#ee4d2d]">
              </div>
              <div v-if="item.requiresJustification" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                 <div class="flex items-start gap-2 text-red-700 font-bold text-[10px] uppercase tracking-wider">
                    <i class="ph-fill ph-warning text-lg"></i>
                    <p>{{ item.divergenciaMsg }}</p>
                 </div>
                 <input type="text" v-model="item.justificativa" placeholder="Justificativa obrigatória..." 
                        class="w-full px-3 py-2 text-xs border border-red-200 rounded-lg outline-none focus:border-red-500 bg-white shadow-sm">
              </div>
            </div>
          </div>

          <button @click="handleRecordingReturn" :disabled="!formDev.list.length || loading"
                  class="w-full bg-[#ee4d2d] text-white py-5 rounded-2xl font-black shadow-xl shadow-brand-orange/20 hover:bg-[#d64428] disabled:opacity-30 transition-all uppercase tracking-widest">
            Confirmar Retorno de {{ formDev.list.length }} Ativos
          </button>
        </div>
      </div>

      <!-- PLANEJAMENTO TAB -->
      <div v-if="currentTab === 'planejamento'" class="space-y-6 max-w-7xl mx-auto animate-in slide-in-from-bottom-5 duration-300">
        <div class="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
           <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div>
                <h2 class="text-3xl font-black text-[#113366] flex items-center gap-3">
                  <i class="ph-fill ph-calendar-plus text-[#ee4d2d]"></i> Define o Planejado
                </h2>
                <p class="text-slate-400 text-sm font-medium">Cadastre a quantidade de PDAs por área e turno.</p>
              </div>
              <div class="flex gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                 <input type="date" v-model="formPlan.data_op" class="bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-[#113366]">
                 <select v-model="formPlan.turno" class="bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-[#113366]">
                    <option value="T1">Turno 1</option>
                    <option value="T2">Turno 2</option>
                    <option value="T3">Turno 3</option>
                 </select>
              </div>
           </div>

           <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <div v-for="area in areas" :key="area.id" class="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:border-[#ee4d2d] hover:shadow-sm">
                 <span class="font-black text-[#113366] uppercase text-xs">{{ area.nome }}</span>
                 <input type="number" v-model="formPlan.areas[area.id]" 
                        class="w-24 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-[#ee4d2d] outline-none text-center font-black text-lg">
              </div>
           </div>

           <div class="flex justify-end pt-6 border-t border-slate-100">
              <button @click="handleSavePlanning" :disabled="loading" class="bg-[#113366] text-white px-10 py-5 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all flex items-center gap-3 uppercase tracking-widest text-sm">
                 <i class="ph-bold ph-floppy-disk text-xl"></i> Salvar Planejamento
              </button>
           </div>
        </div>
      </div>

      <!-- ON PAGE TAB -->
      <div v-if="currentTab === 'onpage'" class="space-y-6 max-w-7xl mx-auto animate-in slide-in-from-bottom-5 duration-300">
         <div class="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
            <div>
              <h2 class="text-3xl font-black text-[#113366] flex items-center gap-2">
                <i class="ph-fill ph-target text-[#ee4d2d]"></i> Realizado vs Planejado
              </h2>
              <p class="text-slate-400 text-sm font-medium">Comparativo operacional por área.</p>
            </div>
            <div class="flex gap-2 w-full md:w-auto font-black font-mono">
              <input type="date" v-model="filtroOnPage.data_op" class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-[#113366]">
              <select v-model="filtroOnPage.turno" class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-[#113366]">
                 <option value="T1">T1</option><option value="T2">T2</option><option value="T3">T3</option>
              </select>
            </div>
         </div>

         <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="item in onPageList" :key="item.areaId" 
                 class="bg-white p-7 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
               <div class="flex justify-between items-start mb-6">
                 <div>
                    <h4 class="font-black text-[#113366] text-xl uppercase tracking-tight">{{ item.areaNome }}</h4>
                    <p class="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Área Operacional</p>
                 </div>
                 <div class="bg-blue-50 text-[#113366] p-3 rounded-2xl group-hover:bg-[#ee4d2d] group-hover:text-white transition-colors">
                    <i class="ph-fill ph-users text-2xl"></i>
                 </div>
               </div>

               <div class="space-y-4">
                  <div class="flex justify-between items-end">
                    <div class="flex flex-col">
                       <span class="text-[10px] font-black text-slate-400 uppercase">Realizado</span>
                       <span class="text-5xl font-black text-[#113366]">{{ item.realizado }}</span>
                    </div>
                    <div class="text-right flex flex-col">
                       <span class="text-[10px] font-black text-slate-400 uppercase">Planejado</span>
                       <span class="text-2xl font-bold" :class="item.planejado ? 'text-slate-300' : 'text-slate-100'">{{ item.planejado || '--' }}</span>
                    </div>
                  </div>

                  <div v-if="item.planejado" class="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                     <div class="h-full transition-all duration-1000 ease-out flex items-center justify-end px-2"
                          :class="item.realizado > item.planejado ? 'bg-red-500' : item.realizado === item.planejado ? 'bg-green-500' : 'bg-brand-orange'"
                          :style="{ width: Math.min((item.realizado / item.planejado) * 100, 100) + '%' }">
                     </div>
                  </div>
                  <div v-if="item.realizado > item.planejado && item.planejado" class="text-[9px] font-black text-red-500 flex items-center gap-1 uppercase tracking-tighter">
                     <i class="ph-fill ph-warning-circle"></i> Acima do limite planejado!
                  </div>
               </div>
            </div>
         </div>
         <div v-if="!onPageList.length" class="text-center py-20 text-slate-200 font-black text-2xl italic border-4 border-dashed border-slate-100 rounded-[50px]">
           Nenhum dado planejado para este período.
         </div>
      </div>

      <!-- CONFIGURAÇÕES TAB -->
      <div v-if="currentTab === 'config'" class="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
         <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
           <h2 class="text-3xl font-black text-[#113366] flex items-center gap-2">
             <i class="ph-fill ph-gear text-[#ee4d2d]"></i> Gestão do Sistema
           </h2>
           <div class="flex gap-4 mt-6">
              <button v-for="st in ['areas', 'lideres', 'estoque']" :key="st" 
                      @click="configSubTab = st"
                      :class="['px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all', 
                              configSubTab === st ? 'bg-[#113366] text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100']">
                 {{ st === 'areas' ? 'Áreas' : st === 'lideres' ? 'Líderes' : 'PDAs (Estoque)' }}
              </button>
           </div>
         </div>

         <!-- ÁREAS CONFIG -->
         <div v-if="configSubTab === 'areas'" class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
               <h4 class="font-black text-[#113366] mb-4 uppercase text-xs tracking-widest">Nova Área</h4>
               <input type="text" v-model="formNewArea.nome" placeholder="Nome da área..." 
                      class="w-full px-4 py-3 border-2 border-slate-100 rounded-xl mb-4 focus:border-[#ee4d2d] outline-none font-bold text-sm">
               <button @click="handleAddArea" :disabled="!formNewArea.nome || loading"
                       class="w-full bg-[#113366] text-white py-3 rounded-xl font-black text-xs hover:bg-[#0c2447] disabled:opacity-30">
                  CADASTRAR ÁREA
               </button>
            </div>
            <div class="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 border-b border-slate-100">
                     <tr><th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Nome da Área</th><th class="px-6 py-4 text-right">Ação</th></tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                     <tr v-for="a in areas" :key="a.id" class="hover:bg-slate-50/50">
                        <td class="px-6 py-4 font-bold text-[#113366] uppercase">{{ a.nome }}</td>
                        <td class="px-6 py-4 text-right">
                           <button @click="handleDeleteArea(a.id)" class="text-slate-300 hover:text-red-500 transition-colors"><i class="ph-bold ph-trash"></i></button>
                        </td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>

         <!-- LÍDERES CONFIG -->
         <div v-if="configSubTab === 'lideres'" class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="md:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-4">
               <h4 class="font-black text-[#113366] mb-4 uppercase text-xs tracking-widest">Novo Líder</h4>
               <div>
                  <label class="text-[9px] font-black text-slate-400 uppercase mb-1 block">Nome Completo</label>
                  <input type="text" v-model="formNewLider.nome" class="w-full px-4 py-2 border-2 border-slate-100 rounded-lg focus:border-[#ee4d2d] outline-none font-bold text-sm">
               </div>
               <div>
                  <label class="text-[9px] font-black text-slate-400 uppercase mb-1 block">Área Fixa</label>
                  <select v-model="formNewLider.area_id" class="w-full px-4 py-2 border-2 border-slate-100 rounded-lg focus:border-[#ee4d2d] outline-none font-bold text-sm">
                     <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.nome }}</option>
                  </select>
               </div>
               <button @click="handleAddLider" :disabled="!formNewLider.nome || !formNewLider.area_id || loading"
                       class="w-full bg-[#113366] text-white py-3 rounded-xl font-black text-xs hover:bg-[#0c2447] disabled:opacity-30">
                  CADASTRAR LÍDER
               </button>
            </div>
            <div class="md:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 border-b border-slate-100">
                     <tr><th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Líder</th><th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Área Vinculada</th><th class="px-6 py-4 text-right">Ação</th></tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                     <tr v-for="l in lideres" :key="l.id" class="hover:bg-slate-50/50">
                        <td class="px-6 py-4 font-bold text-[#113366]">{{ l.nome }}</td>
                        <td class="px-6 py-4 uppercase font-bold text-slate-400">{{ l.areas?.nome || 'Sem Área' }}</td>
                        <td class="px-6 py-4 text-right">
                           <button @click="handleDeleteLider(l.id)" class="text-slate-300 hover:text-red-500 transition-colors"><i class="ph-bold ph-trash"></i></button>
                        </td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>

         <!-- ESTOQUE CONFIG -->
         <div v-if="configSubTab === 'estoque'" class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="md:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-4">
               <h4 class="font-black text-[#113366] mb-4 uppercase text-xs tracking-widest">Novo Ativo</h4>
               <div>
                  <label class="text-[9px] font-black text-slate-400 uppercase mb-1 block">Serial Number (SN)</label>
                  <input type="text" v-model="formNewAsset.sn" class="w-full px-4 py-2 border-2 border-slate-100 rounded-lg focus:border-[#ee4d2d] outline-none font-black font-mono text-sm uppercase">
               </div>
               <div>
                  <label class="text-[9px] font-black text-slate-400 uppercase mb-1 block">Modelo</label>
                  <input type="text" v-model="formNewAsset.modelo" placeholder="Ex: Zebra TC21" class="w-full px-4 py-2 border-2 border-slate-100 rounded-lg focus:border-[#ee4d2d] outline-none font-bold text-sm">
               </div>
               <button @click="handleAddAsset" :disabled="!formNewAsset.sn || loading"
                       class="w-full bg-[#ee4d2d] text-white py-3 rounded-xl font-black text-xs hover:bg-[#d64428] disabled:opacity-30 shadow-lg shadow-brand-orange/20">
                  ADICIONAR PDA
               </button>
            </div>
            <div class="md:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 border-b border-slate-100">
                     <tr><th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">SN</th><th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Modelo</th><th class="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Status</th><th class="px-6 py-4 text-right">Ação</th></tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                     <tr v-for="item in estoque" :key="item.sn" class="hover:bg-slate-50/50 font-mono">
                        <td class="px-6 py-4 font-black text-[#113366] italic">{{ item.sn }}</td>
                        <td class="px-6 py-4 font-sans font-bold text-slate-500">{{ item.modelo }}</td>
                        <td class="px-6 py-4 font-sans">
                           <span :class="['text-[9px] font-black px-2 py-0.5 rounded-full border', 
                                         item.status==='Disponível'?'bg-green-50 text-green-600':item.status==='Emprestado'?'bg-orange-50 text-orange-600':'bg-red-50 text-red-600']">
                             {{ item.status }}
                           </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                           <button @click="handleDeleteAsset(item.sn)" class="text-slate-300 hover:text-red-500 transition-colors"><i class="ph-bold ph-trash"></i></button>
                        </td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      <!-- DELIVERY MODAL -->
      <div v-if="modal.ativo" class="fixed inset-0 bg-[#113366]/90 backdrop-blur-md z-[210] flex items-center justify-center p-4">
        <div class="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
          <div class="bg-[#ee4d2d] p-8 text-white relative">
            <button @click="modal.ativo = false" class="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
               <i class="ph-bold ph-x text-2xl"></i>
            </button>
            <p class="text-[10px] font-black uppercase tracking-[4px] opacity-70 mb-2 font-sans">Checkout Mobile</p>
            <h3 class="text-3xl font-black uppercase tracking-tight">{{ modal.sol.lideres?.nome }}</h3>
            <div class="flex justify-between items-center mt-8 bg-black/10 p-5 rounded-3xl border border-white/10 shadow-inner">
              <div class="text-center flex-1">
                <p class="text-[10px] font-bold opacity-60 uppercase mb-1">Pedido</p>
                <p class="text-4xl font-black">{{ modal.sol.quantidade }}</p>
              </div>
              <div class="w-px h-10 bg-white/20"></div>
              <div class="text-center flex-1">
                <p class="text-[10px] font-bold opacity-60 uppercase mb-1">Bipados</p>
                <p class="text-4xl font-black" :class="modal.sns.length === modal.sol.quantidade ? 'text-green-300' : ''">{{ modal.sns.length }}</p>
              </div>
            </div>
          </div>
          <div class="p-8 space-y-6">
            <input type="text" v-model="modal.currentSn" @keyup.enter="handleBiparInModal" ref="inputModal"
                   placeholder="SCANNER ATIVO..."
                   class="w-full bg-slate-50 border-4 border-slate-100 rounded-[24px] px-6 py-6 text-center font-mono font-black text-3xl text-[#113366] focus:border-[#ee4d2d] outline-none transition-all placeholder:text-slate-200">
            
            <div class="space-y-2 max-h-40 overflow-auto custom-scrollbar font-mono">
              <div v-for="(sn, i) in modal.sns" :key="i" class="flex justify-between items-center bg-slate-50 border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
                <span class="font-black text-[#113366]">{{ sn }}</span>
                <button @click="modal.sns.splice(i, 1)" class="text-slate-300 hover:text-red-500 transition-colors"><i class="ph-bold ph-trash"></i></button>
              </div>
            </div>

            <button @click="finishDelivery" :disabled="!modal.sns.length || loading"
                    class="w-full bg-[#ee4d2d] text-white py-5 rounded-[24px] font-black shadow-2xl shadow-brand-orange/30 disabled:opacity-30 hover:bg-[#d64428] transition-all uppercase tracking-widest text-sm">
              Concluir Entrega
            </button>
          </div>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { supabase } from '../lib/supabase';
import { getInfoOperacional } from '../utils/shiftLogic';

// State
// Persistência de Aba
const currentTab = ref(localStorage.getItem('admin_tab') || 'dash');
watch(currentTab, (val) => localStorage.setItem('admin_tab', val));
const loading = ref(true);
const toasts = ref([]);
const estoque = ref([]);
const lideres = ref([]);
const solicitacoes = ref([]);
const planejamento = ref([]);
const areas = ref([]);
const filtro = ref({ busca: '', status: '' });
const filtroOnPage = ref({ data_op: '', turno: '' });
const configSubTab = ref('areas');

// Forms
// Forms
const formEmp = ref({ responsavelId: '', curSn: '', sns: [] });
const formDev = ref({ responsavelId: '', curSn: '', list: [] });
const modal = ref({ ativo: false, sol: null, sns: [], currentSn: '' });
const formPlan = ref({ data: '', turno: 'T1', areas: {} }); // Changed data_op to data since I replaced it
const formNewArea = ref({ nome: '' });
const formNewLider = ref({ nome: '', area_id: '' });
const formNewAsset = ref({ sn: '', modelo: '' });

const tabs = [
  { id: 'dash', label: 'Dashboard', icon: 'ph-squares-four' },
  { id: 'solicitacoes', label: 'Solicitações', icon: 'ph-bell' },
  { id: 'emprestimo', label: 'Saída Manual', icon: 'ph-handshake' },
  { id: 'devolucao', label: 'Retorno', icon: 'ph-arrow-u-up-left' },
  { id: 'planejamento', label: 'Planejamento', icon: 'ph-calendar-plus' },
  { id: 'onpage', label: 'On Page', icon: 'ph-presentation-chart' }
];

// Computed
const badgeCounts = computed(() => ({
  sol: solicitacoes.value.filter(s => s.status === 'PENDENTE' || s.status === 'APROVADO').length
}));

const kpis = computed(() => {
  const k = { total: estoque.value.length, disponiveis: 0, emprestados: 0, quebrados: 0 };
  estoque.value.forEach(item => {
    if (item.status === 'Disponível') k.disponiveis++;
    else if (item.status === 'Emprestado') k.emprestados++;
    else if (item.status === 'Quebrado') k.quebrados++;
  });
  return k;
});

const kpiCards = computed(() => [
  { label: 'Ativos Totais', value: kpis.value.total, filterVal: '', icon: 'ph-fill ph-package', iconBg: 'bg-blue-50', iconColor: 'text-brand-blue', activeClass: 'bg-[#113366] text-white border-[#113366] shadow-lg shadow-brand-blue/20' },
  { label: 'Em Estoque', value: kpis.value.disponiveis, filterVal: 'Disponível', icon: 'ph-fill ph-check-circle', iconBg: 'bg-green-50', iconColor: 'text-green-600', activeClass: 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-600/20' },
  { label: 'Líderes', value: kpis.value.emprestados, filterVal: 'Emprestado', icon: 'ph-fill ph-users', iconBg: 'bg-orange-50', iconColor: 'text-brand-orange', activeClass: 'bg-[#ee4d2d] text-white border-[#ee4d2d] shadow-lg shadow-brand-orange/20' },
  { label: 'Avariados', value: kpis.value.quebrados, filterVal: 'Quebrado', icon: 'ph-fill ph-wrench', iconBg: 'bg-red-50', iconColor: 'text-red-600', activeClass: 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20' },
]);

const estoqueFiltrado = computed(() => {
  return estoque.value.filter(i => {
    const t = filtro.value.busca.toLowerCase();
    return (t === '' || i.sn.toLowerCase().includes(t)) &&
           (filtro.value.status === '' || i.status === filtro.value.status);
  });
});

const onPageList = computed(() => {
  if (!filtroOnPage.value.data_op || !filtroOnPage.value.turno) return [];
  
  return areas.value.map(area => {
    const plan = planejamento.value.find(p => p.area_id === area.id && p.data === filtroOnPage.value.data_op && p.turno === filtroOnPage.value.turno);
    
    // Calcula realizado: quantos ativos estão com líderes vinculados a esta área
    const realizado = estoque.value.filter(e => {
        if (e.status !== 'Emprestado') return false;
        const lid = lideres.value.find(l => l.nome === e.responsavel);
        return lid && lid.area_id === area.id;
    }).length;

    return {
      areaId: area.id,
      areaNome: area.nome,
      realizado,
      planejado: plan ? plan.quantidade : 0
    };
  }).filter(a => a.planejado > 0);
});

// Methods
const showMessage = (msg, tipo = 'sucesso') => {
  const id = Date.now();
  toasts.value.push({ id, mensagem: msg, tipo });
  setTimeout(() => toasts.value = toasts.value.filter(t => t.id !== id), 5000);
};

const navClass = (id) => {
  return `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${currentTab.value === id ? 'bg-[#ee4d2d] text-white shadow-xl translate-x-1' : 'text-slate-400 hover:text-white hover:bg-white/5'}`;
};

const solStatusClass = (s) => {
  if (s === 'PENDENTE') return 'border-orange-100 bg-orange-50/20';
  if (s === 'APROVADO') return 'border-blue-100 bg-blue-50/20 shadow-brand-blue/5';
  if (s === 'CONCLUIDO') return 'border-green-100 bg-green-50/20 opacity-60';
  return 'border-slate-100 opacity-40';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fetchInitialData = async () => {
  loading.value = true;
  try {
    // Inventory
    const { data: est, error: estError } = await supabase.from('estoque').select('*, ativos_atuais(responsavel_id, lideres(nome))');
    if (estError) throw estError;
    estoque.value = est.map(e => {
        const aa = e.ativos_atuais;
        // Handle 1:1 format (object) or array formats cleanly
        const currentAtivo = Array.isArray(aa) ? aa[0] : aa;
        return { 
            ...e, 
            responsavel: currentAtivo?.lideres?.nome || '-',
            responsavel_id: currentAtivo?.responsavel_id || null
        };
    });

    // Leaders
    const { data: lid, error: lidError } = await supabase.from('lideres').select('*, areas(nome)');
    if (lidError) throw lidError;
    lideres.value = lid;

    // Requests
    const { data: sol, error: solError } = await supabase.from('solicitacoes').select('*, lideres(nome)').order('data', { ascending: false });
    if (solError) throw solError;
    solicitacoes.value = sol;

    // Transfers
    const { data: trc, error: trcError } = await supabase.from('trocas')
        .select('*, lideres_origem:lider_origem(nome), lideres_destino:lider_destino(nome)')
        .order('data', { ascending: false });
    if (trcError) throw trcError;
    trocas.value = trc;

    // Areas
    const { data: areasData, error: areasError } = await supabase.from('areas').select('*').order('nome');
    if (areasError) throw areasError;
    areas.value = areasData;

    // Planning
    const { data: planData, error: planError } = await supabase.from('planejamento').select('*');
    if (planError) throw planError;
    planejamento.value = planData;

    // Set Defaults for Filters
    const op = getInfoOperacional();
    if (!filtroOnPage.value.data_op) {
        filtroOnPage.value.data_op = op.dataOperacional;
        filtroOnPage.value.turno = op.turno;
    }
    if (!formPlan.value.data_op) {
        formPlan.value.data_op = op.dataOperacional;
        formPlan.value.turno = op.turno;
    }

  } catch (e) {
    showMessage('Erro na API: ' + e.message, 'erro');
  } finally {
    loading.value = false;
  }
};

// HANDLERS
const handleActionSol = async (id, status) => {
  loading.value = true;
  const { error } = await supabase.from('solicitacoes').update({ status }).eq('id', id);
  if (error) showMessage(error.message, 'erro');
  else showMessage(`Pedido ${status.toLowerCase()} com sucesso!`);
  loading.value = false;
};

const handleDeleteSol = async (id) => {
  if (!confirm('Excluir esta solicitação permanentemente?')) return;
  loading.value = true;
  const { error } = await supabase.from('solicitacoes').delete().eq('id', id);
  if (error) showMessage(error.message, 'erro');
  else showMessage('Solicitação excluída!');
  loading.value = false;
};


const openDeliveryModal = (sol) => {
  modal.value = { ativo: true, sol, sns: [], currentSn: '' };
  nextTick(() => document.querySelector('input')?.focus());
};

const handleBiparInModal = () => {
  const sn = modal.value.currentSn.trim().toUpperCase();
  if (!sn) return;
  const item = estoque.value.find(e => e.sn === sn);
  if (!item) return showMessage('PDA não encontrado no sistema!', 'erro');
  if (item.status !== 'Disponível') return showMessage(`Este PDA está com status: ${item.status}`, 'erro');
  if (modal.value.sns.includes(sn)) return modal.value.currentSn = '';
  modal.value.sns.push(sn);
  modal.value.currentSn = '';
};

const finishDelivery = async () => {
  loading.value = true;
  const { sol, sns } = modal.value;
  try {
    const inserts = sns.map(sn => ({ sn, responsavel_id: sol.lider_id }));
    await supabase.from('ativos_atuais').upsert(inserts);
    await supabase.from('estoque').update({ status: 'Emprestado' }).in('sn', sns);
    const logs = sns.map(sn => ({ sn, responsavel_id: sol.lider_id, tipo: 'Saída', admin_id: 'Admin Web' }));
    await supabase.from('movimentacoes').insert(logs);
    await supabase.from('solicitacoes').update({ status: 'CONCLUIDO' }).eq('id', sol.id);

    showMessage(`Entrega de ${sns.length} coletor(es) concluída!`);
    modal.value.ativo = false;
    await fetchInitialData(); // Force Refresh
  } catch (e) {
    showMessage(e.message, 'erro');
  } finally {
    loading.value = false;
  }
};

const handleBiparManual = () => {
  const sn = formEmp.value.curSn.trim().toUpperCase();
  if (!sn) return;
  const item = estoque.value.find(e => e.sn === sn);
  if (!item) showMessage('PDA inexistente!', 'erro');
  else if (item.status !== 'Disponível') showMessage('PDA não disponível!', 'erro');
  else if (!formEmp.value.sns.includes(sn)) formEmp.value.sns.push(sn);
  formEmp.value.curSn = '';
};

const handleRecordingLoan = async () => {
  loading.value = true;
  try {
    const { responsavelId, sns } = formEmp.value;
    await supabase.from('ativos_atuais').upsert(sns.map(sn => ({ sn, responsavel_id: responsavelId })));
    await supabase.from('estoque').update({ status: 'Emprestado' }).in('sn', sns);
    await supabase.from('movimentacoes').insert(sns.map(sn => ({ sn, responsavel_id: responsavelId, tipo: 'Saída', admin_id: 'Admin Manual' })));
    showMessage(`${sns.length} ativos atribuídos com sucesso!`);
    formEmp.value = { responsavelId: '', curSn: '', sns: [] };
    await fetchInitialData(); // Force Refresh
  } catch (e) {
    showMessage(e.message, 'erro');
  } finally {
    loading.value = false;
  }
};

const handleBiparDev = () => {
  const sn = formDev.value.curSn.trim().toUpperCase();
  if (!sn) return;
  if (!formDev.value.responsavelId) {
    showMessage('Selecione quem está devolvendo primeiro!', 'erro');
    return;
  }
  const itemEst = estoque.value.find(e => e.sn === sn);
  if (!itemEst) {
    showMessage('Ativo não encontrado no sistema.', 'erro');
    return;
  }

  if (!formDev.value.list.find(i => i.sn === sn)) {
    let requiresJustification = false;
    let divergenciaMsg = '';
    
    if (itemEst.responsavel_id && itemEst.responsavel_id !== formDev.value.responsavelId) {
      requiresJustification = true;
      const returningLid = lideres.value.find(l => l.id === formDev.value.responsavelId)?.nome || 'Outro';
      divergenciaMsg = `Pda sob posse de ${itemEst.responsavel}, mas ${returningLid} está devolvendo.`;
    }

    formDev.value.list.push({ 
      sn, 
      condicao: 'OK', 
      observacao: '', 
      responsavel: itemEst.responsavel || '-', 
      requiresJustification,
      divergenciaMsg,
      justificativa: ''
    });
  }
  formDev.value.curSn = '';
};

const handleRecordingReturn = async () => {
  if (!formDev.value.responsavelId) {
    showMessage('Selecione quem está devolvendo os aparelhos!', 'erro');
    return;
  }
  
  const justMissing = formDev.value.list.find(i => i.requiresJustification && !i.justificativa.trim());
  if (justMissing) {
    showMessage('Preencha as justificativas obrigatórias geradas pelas divergências.', 'erro');
    return;
  }

  loading.value = true;
  try {
    const sns = formDev.value.list.map(i => i.sn);
    await supabase.from('ativos_atuais').delete().in('sn', sns);
    for (const item of formDev.value.list) {
      const finalObs = [item.observacao, item.justificativa ? `Divergência de dono: ${item.justificativa}` : ''].filter(Boolean).join(' | ');
      
      await supabase.from('estoque').update({ 
        status: item.condicao === 'Quebrado' ? 'Quebrado' : 'Disponível',
        observacao: finalObs
      }).eq('sn', item.sn);
      
      await supabase.from('movimentacoes').insert({ 
        sn: item.sn, 
        tipo: 'Retorno', 
        condicao: item.condicao, 
        observacao: finalObs, 
        responsavel_id: formDev.value.responsavelId,
        admin_id: 'Admin Web' 
      });
    }
    showMessage(`${sns.length} retornos processados!`);
    formDev.value = { responsavelId: '', curSn: '', list: [] };
    await fetchInitialData(); // Force Refresh
  } catch (e) {
    showMessage(e.message, 'erro');
  } finally {
    loading.value = false;
  }
};

const handleSavePlanning = async () => {
    loading.value = true;
    try {
        const payload = Object.entries(formPlan.value.areas).map(([areaId, qty]) => ({
            data: formPlan.value.data_op,
            turno: formPlan.value.turno,
            area_id: areaId,
            quantidade: qty
        }));

        const { error } = await supabase.from('planejamento').upsert(payload, { onConflict: 'data, turno, area_id' });
        if (error) throw error;
        
        showMessage('Planejamento salvo com sucesso!');
        await fetchInitialData();
    } catch (e) {
        showMessage(e.message, 'erro');
    } finally {
        loading.value = false;
    }
};

const handleAddArea = async () => {
  loading.value = true;
  try {
    const { error } = await supabase.from('areas').insert({ nome: formNewArea.value.nome });
    if (error) throw error;
    showMessage('Área cadastrada!');
    formNewArea.value.nome = '';
    await fetchInitialData();
  } catch (e) { showMessage(e.message, 'erro'); }
  finally { loading.value = false; }
};

const handleDeleteArea = async (id) => {
  if (!confirm('Excluir esta área? Isso também apagará o planejamento vinculado a ela.')) return;
  loading.value = true;
  try {
    // 1. Apagar planejamento vinculado (Evita erro 409 Conflict)
    await supabase.from('planejamento').delete().eq('area_id', id);

    // 2. Apagar a área
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) throw error;

    showMessage('Área e planejamentos excluídos.');
    await fetchInitialData();
  } catch (e) { showMessage(e.message, 'erro'); }
  finally { loading.value = false; }
};

const handleAddLider = async () => {
    loading.value = true;
    try {
        const { error } = await supabase.from('lideres').insert({ 
            nome: formNewLider.value.nome, 
            area_id: formNewLider.value.area_id 
        });
        if (error) throw error;
        showMessage('Líder cadastrado!');
        formNewLider.value = { nome: '', area_id: '' };
        await fetchInitialData();
    } catch (e) { showMessage(e.message, 'erro'); }
    finally { loading.value = false; }
};

const handleDeleteLider = async (id) => {
    if (!confirm('Excluir este líder?')) return;
    loading.value = true;
    try {
        const { error } = await supabase.from('lideres').delete().eq('id', id);
        if (error) throw error;
        showMessage('Líder excluído.');
        await fetchInitialData();
    } catch (e) { showMessage(e.message, 'erro'); }
    finally { loading.value = false; }
};

const handleAddAsset = async () => {
    loading.value = true;
    try {
        const { error } = await supabase.from('estoque').insert({ 
            sn: formNewAsset.value.sn.toUpperCase().trim(), 
            modelo: formNewAsset.value.modelo || 'Zebra TC21' 
        });
        if (error) throw error;
        showMessage('Ativo adicionado ao estoque!');
        formNewAsset.value = { sn: '', modelo: '' };
        await fetchInitialData();
    } catch (e) { showMessage(e.message, 'erro'); }
    finally { loading.value = false; }
};

const handleDeleteAsset = async (sn) => {
    if (!confirm('Excluir este ativo definitivamente?')) return;
    loading.value = true;
    try {
        const { error } = await supabase.from('estoque').delete().eq('sn', sn);
        if (error) throw error;
        showMessage('Ativo removido.');
        await fetchInitialData();
    } catch (e) { showMessage(e.message, 'erro'); }
    finally { loading.value = false; }
};


// Subscriptions
let allChannel;

let debounceTimeout;

onMounted(() => {
  fetchInitialData();
  allChannel = supabase.channel('global-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, () => fetchInitialData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ativos_atuais' }, () => fetchInitialData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, () => fetchInitialData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planejamento' }, () => fetchInitialData())
    .subscribe();
});

onUnmounted(() => {
  if (allChannel) supabase.removeChannel(allChannel);
  clearTimeout(debounceTimeout);
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
</style>
