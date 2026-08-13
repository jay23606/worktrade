export function createCoordinationClickHandler({ getState, respondScheduleWindow, loadRemoteWorkspace, closeModal, notify, scheduleCoordinationModal, manageLedgerItem, agreementLedgerModal, ledgerStatusModal, changeOrderModal, respondChangeOrder, changeOrderHubModal, manageWorkIssue }) {
  const state = getState();
  return function handleCoordinationClick(event) {
    const scheduleResponse=event.target.closest("[data-schedule-response]");
    if(scheduleResponse){const[response,id]=scheduleResponse.dataset.scheduleResponse.split(":");respondScheduleWindow(id,response).then(loadRemoteWorkspace).then(()=>{closeModal();notify(`Schedule ${response}`)}).catch(error=>notify(error.message));}
    const scheduleCounter=event.target.closest("[data-schedule-counter]");
    if(scheduleCounter)scheduleCoordinationModal(state.requests.find(x=>x.id===state.selectedId),scheduleCounter.dataset.scheduleCounter);
    const calendarExport=event.target.closest("[data-calendar-export]");
    if(calendarExport){const stamp=x=>new Date(x).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");const clean=x=>String(x||"").replace(/[\\;,\n]/g," ");const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//WorkTrade//Schedule//EN\r\nBEGIN:VEVENT\r\nUID:${calendarExport.dataset.calendarExport}@worktrade\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(calendarExport.dataset.start)}\r\nDTEND:${stamp(calendarExport.dataset.end)}\r\nSUMMARY:${clean(calendarExport.dataset.title)}\r\nLOCATION:${clean(calendarExport.dataset.location)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));link.download="worktrade-schedule.ics";link.click();URL.revokeObjectURL(link.href);}
    const ledgerAction=event.target.closest("[data-ledger-action]");if(ledgerAction){const[actionName,id]=ledgerAction.dataset.ledgerAction.split(":");manageLedgerItem(id,actionName).then(()=>agreementLedgerModal(state.requests.find(x=>x.id===state.selectedId))).then(()=>notify("Shared item approved")).catch(error=>notify(error.message));}
    const ledgerStatus=event.target.closest("[data-ledger-status]");if(ledgerStatus)ledgerStatusModal(ledgerStatus.dataset.ledgerStatus);
    const proposeChange=event.target.closest("[data-propose-change]");if(proposeChange)changeOrderModal(proposeChange.dataset.proposeChange);
    const changeResponse=event.target.closest("[data-change-response]");if(changeResponse){const[choice,id]=changeResponse.dataset.changeResponse.split(":");respondChangeOrder(id,choice==="accept").then(loadRemoteWorkspace).then(()=>changeOrderHubModal(state.requests.find(x=>x.id===state.selectedId))).then(()=>notify(`Change ${choice}ed`)).catch(error=>notify(error.message));}
    const issueAction=event.target.closest("[data-issue-action]");if(issueAction){const[actionName,id]=issueAction.dataset.issueAction.split(":");const allowed=actionName!=="escalate"||confirm("Escalate this issue and place the whole agreement in dispute?");if(allowed)manageWorkIssue(id,actionName).then(loadRemoteWorkspace).then(()=>{closeModal();notify(actionName==="escalate"?"Issue escalated to dispute":"Issue closed")}).catch(error=>notify(error.message));}
      };
}

