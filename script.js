/* ClassReserve prototype. Data is stored in this browser's localStorage.
   This is for demonstration only: use Supabase authentication and database rules before real deployment. */
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const STORE = { rooms:'cr_rooms_v1', bookings:'cr_bookings_v1', users:'cr_users_v1', session:'cr_session_v1' };
  const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = (key, fallback) => { try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  let rooms = read(STORE.rooms, null) || [
    {id:'r101',name:'Lecture Hall 101',building:'Main Building',capacity:80,equipment:'Projector, microphone, whiteboard',status:'Available'},
    {id:'r204',name:'Computer Lab 204',building:'Technology Block',capacity:35,equipment:'Computers, projector, air conditioning',status:'Available'},
    {id:'r305',name:'Discussion Room 305',building:'Learning Center',capacity:20,equipment:'Whiteboard, display screen',status:'Available'},
    {id:'r12',name:'Science Lab 12',building:'Science Building',capacity:28,equipment:'Lab benches, sink, safety equipment',status:'Available'}
  ];
  let bookings = read(STORE.bookings, []);
  let users = read(STORE.users, []);
  let currentUser = read(STORE.session, null);
  let currentView = 'dashboard';
  let toastTimer;
  write(STORE.rooms, rooms);
  const saveAll = () => { write(STORE.rooms,rooms); write(STORE.bookings,bookings); write(STORE.users,users); };
  const roleLabel = role => ({admin:'Administrator',faculty:'Faculty',student:'Student'}[role] || role);
  const pill = status => `<span class="pill ${safe(status.toLowerCase())}">${safe(status)}</span>`;
  const roomById = id => rooms.find(r=>r.id===id);
  const visibleBookings = () => currentUser.role==='admin' ? bookings : bookings.filter(b=>b.userId===currentUser.id);
  const dateText = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '—';
  const timeText = t => t ? new Date(`2000-01-01T${t}`).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : '';
  const setToast = msg => { const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3000); };
  const setView = view => { currentView=view; $('#pageCrumb').textContent=view[0].toUpperCase()+view.slice(1); $$('.nav-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); render(); $('#sidebar').classList.remove('open'); };
  function initApp(){
    $('#year').textContent=new Date().getFullYear();
    $('#todayLabel').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    $('#loginScreen').classList.toggle('hidden',!!currentUser);
    $('#dashboardApp').classList.toggle('hidden',!currentUser);
    if(currentUser){ $('#topAvatar').textContent=(currentUser.name||'U').trim().charAt(0).toUpperCase(); $$('.admin-only').forEach(el=>el.classList.toggle('hidden',currentUser.role!=='admin')); setView(currentView); }
  }
  function stats(){
    const list=visibleBookings();
    return [
      {label:'Total classrooms',value:rooms.length,caption:'Registered learning spaces',icon:'▤'},
      {label:'Available rooms',value:rooms.filter(r=>r.status==='Available').length,caption:'Ready to be reserved',icon:'⌂'},
      {label:currentUser.role==='admin'?'Pending requests':'My pending requests',value:list.filter(b=>b.status==='Pending').length,caption:'Awaiting admin review',icon:'◷'},
      {label:currentUser.role==='admin'?'Approved bookings':'My approved bookings',value:list.filter(b=>b.status==='Approved').length,caption:'Confirmed reservations',icon:'✓'}
    ];
  }
  function heading(title,desc,action=''){return `<div class="page-heading"><div><span class="eyebrow">${currentUser.role==='admin'?'ADMIN WORKSPACE':currentUser.role==='faculty'?'FACULTY WORKSPACE':'STUDENT WORKSPACE'}</span><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;}
  function statCards(){return `<div class="stats-grid">${stats().map(s=>`<article class="stat-card"><div class="stat-top">${s.label}<span class="stat-icon">${s.icon}</span></div><div class="stat-number">${s.value}</div><div class="stat-caption">${s.caption}</div></article>`).join('')}</div>`;}
  function roomCard(r){return `<article class="room-card"><div class="room-card-top"><span class="room-symbol">▤</span>${pill(r.status)}</div><h3>${safe(r.name)}</h3><div class="room-meta">⌖ ${safe(r.building)}<br>♙ Capacity: ${r.capacity} people<br>⚙ ${safe(r.equipment||'Standard facilities')}</div><div class="room-footer"><span>${r.capacity} seats</span>${r.status==='Available'?`<button data-book-room="${safe(r.id)}">Request room →</button>`:'<span>Unavailable</span>'}${currentUser.role==='admin'?`<button data-edit-room="${safe(r.id)}">Edit</button>`:''}</div></article>`;}
  function recentActivity(){
    const list=[...visibleBookings()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
    if(!list.length)return '<div class="empty-state"><strong>No reservations yet</strong>Your reservation activity will appear here.</div>';
    return `<div class="activity-list">${list.map(b=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${safe(b.roomName)} · ${pill(b.status)}</strong><small>${safe(b.purpose)}<br>${dateText(b.date)} · ${timeText(b.start)}–${timeText(b.end)}</small></div></div>`).join('')}</div>`;
  }
  function dashboardView(){
    const action=currentUser.role==='admin'?'<button class="primary-button" data-action="add-room">＋ Add classroom</button>':'<button class="primary-button" data-action="new-booking">＋ Request a classroom</button>';
    return heading(`Good day, ${safe(currentUser.name.split(' ')[0])} 👋`,'Here is what is happening with classroom reservations today.',action)+statCards()+`<div class="content-grid"><section class="panel"><div class="panel-heading"><h2>Classrooms</h2><button class="text-button" data-action="classrooms">View all →</button></div><div class="room-grid">${rooms.filter(r=>r.status==='Available').slice(0,4).map(roomCard).join('')||'<div class="empty-state">No available classrooms.</div>'}</div></section><section class="panel"><div class="panel-heading"><h2>Recent reservation activity</h2><button class="text-button" data-action="reservations">View all →</button></div>${recentActivity()}</section></div>`;
  }
  function classroomsView(){
    const adminAction=currentUser.role==='admin'?'<button class="primary-button" data-action="add-room">＋ Add classroom</button>':'<button class="primary-button" data-action="new-booking">＋ Request reservation</button>';
    return heading('Classrooms','Browse rooms, capacity, facilities, and availability.',adminAction)+`<div class="toolbar"><input class="search-input" id="roomSearch" placeholder="Search by room, building, or equipment"><select class="filter-select" id="roomFilter"><option value="All">All statuses</option><option>Available</option><option>Maintenance</option></select></div><div class="panel"><div class="room-grid" id="roomGrid">${rooms.map(roomCard).join('')||'<div class="empty-state">No classrooms added yet.</div>'}</div></div>`;
  }
  function reservationsView(){
    const list=[...visibleBookings()].sort((a,b)=>b.createdAt-a.createdAt);
    return heading('Reservations','Track booking requests and reservation history.',currentUser.role==='admin'?'':'<button class="primary-button" data-action="new-booking">＋ New request</button>')+`<div class="toolbar"><input class="search-input" id="bookingSearch" placeholder="Search room, requester, or purpose"><select class="filter-select" id="bookingFilter"><option value="All">All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></div><section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Classroom / purpose</th><th>Requester</th><th>Date & time</th><th>People</th><th>Status</th><th>Actions</th></tr></thead><tbody id="bookingRows">${bookingRows(list)}</tbody></table></div></section>`;
  }
  function bookingRows(list){
    if(!list.length)return '<tr><td colspan="6"><div class="empty-state"><strong>No reservations found</strong>Requests will show up here when submitted.</div></td></tr>';
    return list.map(b=>`<tr data-booking-row="${safe(b.id)}"><td><span class="table-primary">${safe(b.roomName)}</span><span class="table-secondary">${safe(b.purpose)}</span></td><td><span class="table-primary">${safe(b.userName)}</span><span class="table-secondary">${safe(b.userEmail)}</span></td><td><span class="table-primary">${dateText(b.date)}</span><span class="table-secondary">${timeText(b.start)} – ${timeText(b.end)}</span></td><td>${b.people}</td><td>${pill(b.status)}</td><td><div class="table-actions">${currentUser.role==='admin'&&b.status==='Pending'?`<button class="small-action approve" data-booking-action="approve" data-id="${safe(b.id)}">Approve</button><button class="small-action reject" data-booking-action="reject" data-id="${safe(b.id)}">Reject</button>`:''}${currentUser.role==='admin'?`<button class="small-action delete" data-booking-action="delete" data-id="${safe(b.id)}">Delete</button>`:''}${currentUser.role!=='admin'&&b.status==='Pending'?`<span class="table-secondary">Awaiting review</span>`:''}</div></td></tr>`).join('');
  }
  function usersView(){
    if(currentUser.role!=='admin')return heading('Access restricted','Only administrators can manage users.')+'<div class="panel">You do not have permission to view this page.</div>';
    return heading('Users','People who have signed in to this prototype.')+`<div class="notice">Prototype note: anyone can choose a role on the demo sign-in screen. Role permissions must be enforced by Supabase authentication and database policies before production.</div><section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>First seen</th></tr></thead><tbody>${users.length?users.map(u=>`<tr><td><div class="user-card"><span class="user-initial">${safe(u.name.charAt(0).toUpperCase())}</span><span class="table-primary">${safe(u.name)}</span></div></td><td>${safe(u.email)}</td><td>${pill(roleLabel(u.role))}</td><td>${dateText(u.createdDate)}</td></tr>`).join(''):'<tr><td colspan="4"><div class="empty-state">No users recorded yet.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function reportsView(){
    if(currentUser.role!=='admin')return heading('Access restricted','Only administrators can view reports.');
    const approved=bookings.filter(b=>b.status==='Approved').length,pending=bookings.filter(b=>b.status==='Pending').length,rejected=bookings.filter(b=>b.status==='Rejected').length;
    return heading('Reports & insights','Review reservation activity and export a CSV report.', '<button class="primary-button" data-action="export">↓ Export CSV</button>')+`<div class="stats-grid"><article class="stat-card"><div class="stat-top">All requests<span class="stat-icon">▥</span></div><div class="stat-number">${bookings.length}</div><div class="stat-caption">Total reservations submitted</div></article><article class="stat-card"><div class="stat-top">Approved<span class="stat-icon">✓</span></div><div class="stat-number">${approved}</div><div class="stat-caption">Confirmed bookings</div></article><article class="stat-card"><div class="stat-top">Pending<span class="stat-icon">◷</span></div><div class="stat-number">${pending}</div><div class="stat-caption">Awaiting review</div></article><article class="stat-card"><div class="stat-top">Rejected<span class="stat-icon">×</span></div><div class="stat-number">${rejected}</div><div class="stat-caption">Requests declined</div></article></div><section class="panel"><div class="panel-heading"><h2>Reservation report</h2><button class="text-button" data-action="export">Export CSV ↓</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Classroom</th><th>Requester</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>${bookings.length?bookings.map(b=>`<tr><td>${safe(b.roomName)}</td><td>${safe(b.userName)}</td><td>${dateText(b.date)}</td><td>${timeText(b.start)}–${timeText(b.end)}</td><td>${pill(b.status)}</td></tr>`).join(''):'<tr><td colspan="5"><div class="empty-state">No report data yet.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function render(){
    if(!currentUser)return;
    $('#pendingBadge').textContent=bookings.filter(b=>b.status==='Pending').length;
    const container=$('#viewContainer');
    container.innerHTML=({dashboard:dashboardView,classrooms:classroomsView,reservations:reservationsView,users:usersView,reports:reportsView}[currentView]||dashboardView)();
    if(currentView==='classrooms')filterRooms();
    if(currentView==='reservations')filterBookings();
  }
  function filterRooms(){
    const query=($('#roomSearch')?.value||'').toLowerCase(),status=$('#roomFilter')?.value||'All';
    const filtered=rooms.filter(r=>(status==='All'||r.status===status)&&`${r.name} ${r.building} ${r.equipment}`.toLowerCase().includes(query));
    $('#roomGrid').innerHTML=filtered.map(roomCard).join('')||'<div class="empty-state">No matching classrooms found.</div>';
  }
  function filterBookings(){
    const query=($('#bookingSearch')?.value||'').toLowerCase(),status=$('#bookingFilter')?.value||'All';
    const filtered=visibleBookings().filter(b=>(status==='All'||b.status===status)&&`${b.roomName} ${b.userName} ${b.purpose} ${b.userEmail}`.toLowerCase().includes(query)).sort((a,b)=>b.createdAt-a.createdAt);
    $('#bookingRows').innerHTML=bookingRows(filtered);
  }
  function openRoomDialog(id=null){
    const form=$('#classroomForm'); form.reset(); $('#classroomId').value=id||'';
    const room=id?roomById(id):null; $('#classroomDialogTitle').textContent=room?'Edit classroom':'Add classroom';
    if(room){$('#roomName').value=room.name;$('#roomBuilding').value=room.building;$('#roomCapacity').value=room.capacity;$('#roomEquipment').value=room.equipment;$('#roomStatus').value=room.status;}
    $('#classroomDialog').showModal();
  }
  function openReservationDialog(roomId=null){
    const available=rooms.filter(r=>r.status==='Available');
    if(!available.length){setToast('There are no available classrooms right now.');return;}
    $('#reservationRoom').innerHTML=available.map(r=>`<option value="${safe(r.id)}">${safe(r.name)} · ${r.capacity} seats</option>`).join('');
    if(roomId&&available.some(r=>r.id===roomId))$('#reservationRoom').value=roomId;
    $('#reservationDate').min=today();$('#reservationDate').value=today();$('#reservationPeople').value='20';$('#startTime').value='09:00';$('#endTime').value='10:00';$('#reservationPurpose').value='';
    $('#reservationDialog').showModal();
  }
  function createBooking(e){
    e.preventDefault();
    const room=roomById($('#reservationRoom').value),date=$('#reservationDate').value,start=$('#startTime').value,end=$('#endTime').value,people=Number($('#reservationPeople').value),purpose=$('#reservationPurpose').value.trim();
    if(!room||room.status!=='Available'){setToast('Please choose an available classroom.');return;}
    if(date<today()){setToast('Please choose today or a future date.');return;}
    if(start>=end){setToast('End time must be later than start time.');return;}
    if(people>room.capacity){setToast(`This room has a capacity of ${room.capacity}.`);return;}
    const conflict=bookings.some(b=>b.roomId===room.id&&b.date===date&&b.status!=='Rejected'&&start<b.end&&end>b.start);
    if(conflict){setToast('That room has a reservation at an overlapping time.');return;}
    bookings.push({id:uid(),roomId:room.id,roomName:room.name,userId:currentUser.id,userName:currentUser.name,userEmail:currentUser.email,role:currentUser.role,date,start,end,people,purpose,status:'Pending',createdAt:Date.now()});
    saveAll();$('#reservationDialog').close();setView('reservations');setToast('Reservation request submitted for admin review.');
  }
  function exportCSV(){
    const rows=[['Classroom','Building','Requester','Email','Role','Date','Start','End','People','Purpose','Status'],...bookings.map(b=>{const r=roomById(b.roomId);return [b.roomName,r?.building||'',b.userName,b.userEmail,roleLabel(b.role),b.date,b.start,b.end,b.people,b.purpose,b.status];})];
    const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`classroom-reservations-${today()}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);setToast('CSV report exported.');
  }
  $('#loginForm').addEventListener('submit',e=>{
    e.preventDefault();const name=$('#fullName').value.trim(),email=$('#email').value.trim().toLowerCase(),role=$('#roleSelect').value;
    if(!name||!email)return;
    let user=users.find(u=>u.email===email&&u.role===role);
    if(!user){user={id:uid(),name,email,role,createdDate:today()};users.push(user);}else user.name=name;
    currentUser={...user};write(STORE.session,currentUser);saveAll();currentView='dashboard';initApp();setToast(`Welcome, ${name.split(' ')[0]}!`);
  });
  $('#logoutBtn').addEventListener('click',()=>{currentUser=null;localStorage.removeItem(STORE.session);$('#dashboardApp').classList.add('hidden');$('#loginScreen').classList.remove('hidden');$('#loginForm').reset();$('#sidebar').classList.remove('open');});
  $('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $$('.nav-link[data-view]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.view==='users'&&currentUser.role!=='admin'){setToast('Only administrators can manage users.');return;}if(btn.dataset.view==='reports'&&currentUser.role!=='admin'){setToast('Only administrators can view reports.');return;}setView(btn.dataset.view);}));
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='add-room')openRoomDialog();if(action==='new-booking')openReservationDialog();if(action==='classrooms')setView('classrooms');if(action==='reservations')setView('reservations');if(action==='export')exportCSV();
    const bookRoom=e.target.closest('[data-book-room]');if(bookRoom)openReservationDialog(bookRoom.dataset.bookRoom);
    const edit=e.target.closest('[data-edit-room]');if(edit)openRoomDialog(edit.dataset.editRoom);
    const bookingAction=e.target.closest('[data-booking-action]');
    if(bookingAction){const b=bookings.find(x=>x.id===bookingAction.dataset.id);if(!b)return;const act=bookingAction.dataset.bookingAction;
      if(act==='approve'||act==='reject'){
        if(act==='approve'){const conflict=bookings.some(other=>other.id!==b.id&&other.roomId===b.roomId&&other.date===b.date&&other.status==='Approved'&&b.start<other.end&&b.end>other.start);if(conflict){setToast('Cannot approve: this overlaps an approved booking.');return;}}
        b.status=act==='approve'?'Approved':'Rejected';saveAll();render();setToast(`Reservation ${b.status.toLowerCase()}.`);
      }else if(act==='delete'&&confirm('Delete this reservation permanently from this browser?')){bookings=bookings.filter(x=>x.id!==b.id);saveAll();render();setToast('Reservation deleted.');}
    }
  });
  $('#classroomForm').addEventListener('submit',e=>{
    e.preventDefault();const id=$('#classroomId').value,data={name:$('#roomName').value.trim(),building:$('#roomBuilding').value.trim(),capacity:Number($('#roomCapacity').value),equipment:$('#roomEquipment').value.trim(),status:$('#roomStatus').value};
    if(id){Object.assign(roomById(id),data);setToast('Classroom updated.');}else{rooms.push({id:uid(),...data});setToast('Classroom added.');}
    saveAll();$('#classroomDialog').close();render();
  });
  $('#reservationForm').addEventListener('submit',createBooking);
  $$('.close-dialog').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
  document.addEventListener('input',e=>{if(e.target.id==='roomSearch')filterRooms();if(e.target.id==='bookingSearch')filterBookings();});
  document.addEventListener('change',e=>{if(e.target.id==='roomFilter')filterRooms();if(e.target.id==='bookingFilter')filterBookings();});
  initApp();
})();
