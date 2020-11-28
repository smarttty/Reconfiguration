import Controller from '@ember/controller';
import { computed, set } from '@ember/object';
import { copy } from '@ember/object/internals';
const translations = {
    'criticalCount': 'Critical',
    'middleCriticalCount': 'Middle-critical',
    'notCriticalCount': 'Non-critical',
};
export default Controller.extend({
    criticalCount: 0,
    middleCriticalCount: 0,
    notCriticalCount: 0,
    deltaP: 1,
    pPorog: 30,
    tInterval: 1,
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    suggestedMin: 0,
                    suggestedMax: 20
                }
            }],
            xAxes: [{
                ticks: {
                    suggestedMin: 0,
                    suggestedMax: 10
                }
            }]
        }, 
        //showLines : true,
    },

    criticalObjects: computed('criticalCount', function () {
        let count = parseInt(this.get('criticalCount'));
        let returnObject = {
            name: translations['criticalCount'],
            data: this.generateRandomObjects('critical', count)
        };
        return returnObject;
    }),

    middleCriticalObjects: computed('middleCriticalCount', function () {
        let count = parseInt(this.get('middleCriticalCount'));
        let returnObject = {
            name: translations['middleCriticalCount'],
            data: this.generateRandomObjects('middleCritical', count)
        };
        return returnObject;
    }),

    notCriticalObjects: computed('notCriticalCount', function () {
        let count = parseInt(this.get('notCriticalCount'));
        let returnObject = {
            name: translations['notCriticalCount'],
            data: this.generateRandomObjects('notCritical', count)
        };
        return returnObject;
    }),

    generateRandomObjects(idPrefix, count) {
        let randomObjects = [];
        for (let index = 0; index < count; index++) {
            let diagnosticObject = {
                id: `${idPrefix}_${index}`,
                currentPowerLevel: this.getRandomValue(parseInt(this.pPorog), 100),
                currentCPULevel: this.getRandomValue(20, 100),
            }
            randomObjects.push(diagnosticObject);
        }
        return randomObjects;
    },

    diagnosticObjects: computed('criticalObjects', 'middleCriticalObjects', 'notCriticalObjects', function () {
        let returnObject = {
            criticalObjects: this.criticalObjects,
            middleCriticalObjects: this.middleCriticalObjects,
            notCriticalObjects: this.notCriticalObjects,
        };
        return returnObject;
    }),

    getRandomValue(min, max) {
        return min + Math.floor(Math.random() * Math.floor(max - min));
    },

    getWorkingObjectsCount(objects) {
        let pPorogInt = parseInt(this.pPorog);
        let workingObjectsCount = 0;
        Object.keys(objects).forEach((objectType) => {
            let workingObjectsByTypeCount = objects[objectType].data.reduce((workingCount, object) => {
                return workingCount + ((object.currentPowerLevel >= pPorogInt) ? 1 : 0);
            }, 0);
            workingObjectsCount += workingObjectsByTypeCount;
        });
        return workingObjectsCount;
    },

    firstIterationWorkersIds: [],

    secondIterationWorkersIds: [],

    getCurrentIterationMiddleWorkers(objects, count, iterationNumber) {
        if (iterationNumber == 0) {
            objects.middleCriticalObjects.data.sort((o1, o2) => {
                if (o1.currentPowerLevel > o2.currentPowerLevel) {
                    return -1;
                }
                else if (o1.currentPowerLevel < o2.currentPowerLevel) {
                    return 1;
                }
                return 0;
            });
            this.firstIterationWorkersIds = [];
            this.secondIterationWorkersIds = [];
            objects.middleCriticalObjects.data.slice(0, count).forEach((worker) => {
                this.firstIterationWorkersIds.push(worker.id)
            });
            objects.middleCriticalObjects.data.slice(count).forEach((worker) => {
                this.secondIterationWorkersIds.push(worker.id)
            });
            return objects.middleCriticalObjects.data.filter((worker) => {
                return this.firstIterationWorkersIds.includes(worker.id);
            });
        }
        else if (iterationNumber % 2 == 1) {
            return objects.middleCriticalObjects.data.filter((worker) => {
                return this.secondIterationWorkersIds.includes(worker.id);
            });
        }
        else {
            return objects.middleCriticalObjects.data.filter((worker) => {
                return this.firstIterationWorkersIds.includes(worker.id);
            });
        }
    },

    reconfigurationAlgorithm(computingObjects){
        
        let middleWorkersCount = (computingObjects.middleCriticalObjects.data.length
            - Math.floor(computingObjects.middleCriticalObjects.data.length / 2));

        let iterationNumber = 0;

        let tStart = parseInt(this.tInterval);

        let graphData = [];

        let deltaPInt = parseFloat(this.deltaP);

        let pPorogInt = parseInt(this.pPorog);


        let currentIterationMiddleWorkers = this.getCurrentIterationMiddleWorkers(computingObjects, middleWorkersCount, iterationNumber).slice(0);
        let notCriticalChecks = computingObjects.notCriticalObjects.data.reduce((accumulator, currentValue) => {
            return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
        }, 0);
        let middleCriticalChecks = currentIterationMiddleWorkers.reduce((accumulator, currentValue) => {
            return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
        }, 0);
        let checksNeededCount = computingObjects.criticalObjects.data.length + (computingObjects.middleCriticalObjects.data.length - currentIterationMiddleWorkers.length);
        let availableChecks = notCriticalChecks + middleCriticalChecks;

        while (checksNeededCount <= availableChecks) {
            
            let currentIterationWorkers = [].concat(currentIterationMiddleWorkers, computingObjects.notCriticalObjects.data.slice(0));
            
            let commonKoff = 0;
            currentIterationWorkers = currentIterationWorkers.filter((worker) => {
                let avaliableWorkerChecks = Math.floor((worker.currentPowerLevel - pPorogInt) / deltaPInt);
                return avaliableWorkerChecks > 0;
            });

            currentIterationWorkers.forEach((worker) => {
                worker.currentIterationKoff = (worker.currentPowerLevel + (100 - worker.currentCPULevel)) / (2 * 100);
                commonKoff += worker.currentIterationKoff;
            });
            currentIterationWorkers.sort((w1, w2) => {
                if (w1.currentIterationKoff > w2.currentIterationKoff) {
                    return -1;
                }
                else if (w1.currentIterationKoff < w2.currentIterationKoff) {
                    return 1;
                }
                return 0;
            });
            let checksToDistribute = checksNeededCount;
            let undistibutedChecks = 0;
            currentIterationWorkers.forEach((worker) => {
                let currentChecks = Math.ceil(checksNeededCount * worker.currentIterationKoff / commonKoff);
                let avaliableWorkerChecks = Math.floor((worker.currentPowerLevel - pPorogInt) / deltaPInt);
                if (currentChecks > avaliableWorkerChecks) {
                    undistibutedChecks += (currentChecks - avaliableWorkerChecks);
                    if (avaliableWorkerChecks > checksToDistribute) {
                        worker.currentChecks = (checksToDistribute > 0) ? checksToDistribute : 0;
                    }
                    else {
                        worker.currentChecks = (checksToDistribute > 0) ? avaliableWorkerChecks : 0;
                    }

                }
                else {
                    if (currentChecks > checksToDistribute) {
                        worker.currentChecks = (checksToDistribute > 0) ? checksToDistribute : 0;
                    }
                    else {
                        worker.currentChecks = (checksToDistribute > 0) ? currentChecks : 0;
                    }
                }
                checksToDistribute -= (checksToDistribute == 0) ? 0 : currentChecks;
                worker.currentPowerLevel -= (worker.currentChecks * deltaPInt);
            });
            if (undistibutedChecks > 0) {
                let workersForUndistribute = currentIterationWorkers.filter((worker) => {
                    let avaliableWorkerChecks = Math.floor((worker.currentPowerLevel - pPorogInt) / deltaPInt);
                    return avaliableWorkerChecks > 0;
                });
                workersForUndistribute.sort((w1, w2) => {
                    let w1availableWorkerChecks = Math.floor((w1.currentPowerLevel - pPorogInt) / deltaPInt);
                    let w2availableWorkerChecks = Math.floor((w2.currentPowerLevel - pPorogInt) / deltaPInt);
                    if (w1availableWorkerChecks > w2availableWorkerChecks) {
                        return -1;
                    }
                    else if (w1availableWorkerChecks < w2availableWorkerChecks) {
                        return 1;
                    }
                    return 0;
                });
                workersForUndistribute.forEach((worker) => {
                    let avaliableWorkerChecks = Math.floor((worker.currentPowerLevel - pPorogInt) / deltaPInt);
                    let addedChecks = (avaliableWorkerChecks > undistibutedChecks) ? undistibutedChecks : avaliableWorkerChecks;
                    worker.currentChecks = (worker.currentChecks) ? worker.currentChecks + addedChecks : addedChecks;
                    undistibutedChecks -= addedChecks;
                });

            }
            let workingCount = 0;
            Object.keys(computingObjects).forEach((groupName)=>{
                if(groupName != 'criticalObjects'){
                    workingCount += computingObjects[groupName].data.filter((object)=>{
                        return object.currentPowerLevel > (pPorogInt + deltaPInt);
                    }).length;
                }
            });
            graphData.push({
                "x" : tStart,
                "y" : workingCount,
            });
            tStart += parseInt(this.tInterval);
            iterationNumber++;
            currentIterationMiddleWorkers = this.getCurrentIterationMiddleWorkers(computingObjects, middleWorkersCount, iterationNumber).slice(0);
            notCriticalChecks = computingObjects.notCriticalObjects.data.reduce((accumulator, currentValue) => {
                return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
            }, 0);
            middleCriticalChecks = currentIterationMiddleWorkers.reduce((accumulator, currentValue) => {
                return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
            }, 0);
            checksNeededCount = computingObjects.criticalObjects.data.length + (computingObjects.middleCriticalObjects.data.length - currentIterationMiddleWorkers.length);
            availableChecks = notCriticalChecks + middleCriticalChecks;


        }
        return graphData;
    },

    oneToAllAlgorithm(computingObjects){
        let middleWorkersCount = (computingObjects.middleCriticalObjects.data.length
            - Math.floor(computingObjects.middleCriticalObjects.data.length / 2));

        let iterationNumber = 0;

        let tStart = parseInt(this.tInterval);

        let graphData = [];

        let deltaPInt = parseFloat(this.deltaP);

        let pPorogInt = parseInt(this.pPorog);

        let currentIterationMiddleWorkers = this.getCurrentIterationMiddleWorkers(computingObjects, middleWorkersCount, iterationNumber).slice(0);
        let notCriticalChecks = computingObjects.notCriticalObjects.data.reduce((accumulator, currentValue) => {
            return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
        }, 0);
        let middleCriticalChecks = currentIterationMiddleWorkers.reduce((accumulator, currentValue) => {
            return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
        }, 0);
        let checksNeededCount = computingObjects.criticalObjects.data.length + (computingObjects.middleCriticalObjects.data.length - currentIterationMiddleWorkers.length);
        let availableChecks = notCriticalChecks + middleCriticalChecks;
        while(checksNeededCount < availableChecks) {
            let currentIterationWorkers = [].concat(currentIterationMiddleWorkers, computingObjects.notCriticalObjects.data.slice(0));
            currentIterationWorkers.sort((w1, w2) => {
                if(w1.currentPowerLevel > w2.currentPowerLevel){
                    return -1;
                }
                else if(w1.currentPowerLevel < w2.currentPowerLevel){
                    return 1;
                }
                return 0;
            });
            let checksToDistribute = checksNeededCount;
            currentIterationWorkers.forEach((worker)=>{
                let avaliableWorkerChecks = Math.floor((worker.currentPowerLevel - pPorogInt) / deltaPInt);
                let currentChecks = 0;
                if(checksToDistribute > 0 && avaliableWorkerChecks > 0){
                    currentChecks = (checksToDistribute > avaliableWorkerChecks) ? avaliableWorkerChecks : checksToDistribute;
                }
                checksToDistribute-=currentChecks;
                worker.currentPowerLevel -= ( currentChecks * deltaPInt);
            });
            let workingCount = 0;
            Object.keys(computingObjects).forEach((groupName)=>{
                if(groupName != 'criticalObjects'){
                    workingCount += computingObjects[groupName].data.filter((object)=>{
                        return object.currentPowerLevel > (pPorogInt + deltaPInt);
                    }).length;
                }
            });
            graphData.push({
                "x" : tStart,
                "y" : workingCount,
            });
            tStart += parseInt(this.tInterval);
            iterationNumber++;
            currentIterationMiddleWorkers = this.getCurrentIterationMiddleWorkers(computingObjects, middleWorkersCount, iterationNumber).slice(0);
            notCriticalChecks = computingObjects.notCriticalObjects.data.reduce((accumulator, currentValue) => {
                return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
            }, 0);
            middleCriticalChecks = currentIterationMiddleWorkers.reduce((accumulator, currentValue) => {
                return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
            }, 0);
            checksNeededCount = computingObjects.criticalObjects.data.length + (computingObjects.middleCriticalObjects.data.length - currentIterationMiddleWorkers.length);
            availableChecks = notCriticalChecks + middleCriticalChecks;
        }
        return graphData;



    },

    oneToAllSimpleAlgorithm(computingObjects){
        let middleWorkersCount = (computingObjects.middleCriticalObjects.data.length
            - Math.floor(computingObjects.middleCriticalObjects.data.length / 2));

        let iterationNumber = 0;

        let tStart = parseInt(this.tInterval);

        let graphData = [];

        let deltaPInt = parseFloat(this.deltaP);

        let pPorogInt = parseInt(this.pPorog);

        let currentIterationMiddleWorkers = this.getCurrentIterationMiddleWorkers(computingObjects, middleWorkersCount, iterationNumber).slice(0);
        let notCriticalChecks = computingObjects.notCriticalObjects.data.reduce((accumulator, currentValue) => {
            return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
        }, 0);
        let middleCriticalChecks = currentIterationMiddleWorkers.reduce((accumulator, currentValue) => {
            return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
        }, 0);
        let checksNeededCount = computingObjects.criticalObjects.data.length + (computingObjects.middleCriticalObjects.data.length - currentIterationMiddleWorkers.length);
        let availableChecks = notCriticalChecks + middleCriticalChecks;
        while(checksNeededCount < availableChecks) {
            let currentIterationWorkers = [].concat(currentIterationMiddleWorkers, computingObjects.notCriticalObjects.data.slice(0));
            let checksToDistribute = checksNeededCount;
            currentIterationWorkers.forEach((worker)=>{
                let avaliableWorkerChecks = Math.floor((worker.currentPowerLevel - pPorogInt) / deltaPInt);
                let currentChecks = 0;
                if(checksToDistribute > 0 && avaliableWorkerChecks > 0){
                    currentChecks = (checksToDistribute > avaliableWorkerChecks) ? avaliableWorkerChecks : checksToDistribute;
                }
                checksToDistribute-=currentChecks;
                worker.currentPowerLevel -= ( currentChecks * deltaPInt);
            });
            let workingCount = 0;
            Object.keys(computingObjects).forEach((groupName)=>{
                if(groupName != 'criticalObjects'){
                    workingCount += computingObjects[groupName].data.filter((object)=>{
                        return object.currentPowerLevel > (pPorogInt + deltaPInt);
                    }).length;
                }
            });
            graphData.push({
                "x" : tStart,
                "y" : workingCount,
            });
            tStart += parseInt(this.tInterval);
            iterationNumber++;
            currentIterationMiddleWorkers = this.getCurrentIterationMiddleWorkers(computingObjects, middleWorkersCount, iterationNumber).slice(0);
            notCriticalChecks = computingObjects.notCriticalObjects.data.reduce((accumulator, currentValue) => {
                return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
            }, 0);
            middleCriticalChecks = currentIterationMiddleWorkers.reduce((accumulator, currentValue) => {
                return accumulator + Math.floor((currentValue.currentPowerLevel - parseInt(this.pPorog)) / deltaPInt);
            }, 0);
            checksNeededCount = computingObjects.criticalObjects.data.length + (computingObjects.middleCriticalObjects.data.length - currentIterationMiddleWorkers.length);
            availableChecks = notCriticalChecks + middleCriticalChecks;
        }
        return graphData;



    },

    actions: {
        computeSituation() {

            let computingObjectsForReconfiguration = copy(this.diagnosticObjects, true);
            let computingObjectsForOneToAll = copy(this.diagnosticObjects, true);
            let computingObjectForSimpleOneToAll = copy(this.diagnosticObjects, true);
            


            let graphData = {
                datasets : [
                    {
                        label : 'Reconfiguration',
                        data: this.reconfigurationAlgorithm(computingObjectsForReconfiguration),
                        backgroundColor: 'red',
                    },
                    {
                        label : '1 -> all (modified)',
                        data : this.oneToAllAlgorithm(computingObjectsForOneToAll),
                        backgroundColor: 'black',
                    },
                    {
                        label : '1 -> all',
                        data : this.oneToAllSimpleAlgorithm(computingObjectForSimpleOneToAll),
                        backgroundColor: 'yellow',
                    }
                ]
            }
            console.log(JSON.stringify(graphData.datasets.reduce((accumulator, dataset)=>{
                accumulator = accumulator.concat(dataset.data);
                return accumulator;
            }, [])));
            set(this, 'graphData', graphData);


            //let workingObjectsCount = this.getWorkingObjectsCount(computingObjects);

            //Итерация

            //}
        }
    }
});
