import {
  Callout,
  Card,
  Code,
  Colors,
  IBreadcrumbProps,
  Intent,
  NonIdealState,
  PopoverInteractionKind,
  Tooltip,
} from '@blueprintjs/core';
import {IconNames} from '@blueprintjs/icons';
import * as React from 'react';
import {useQuery} from 'react-apollo';

import {useRepositorySelector} from 'src/DagsterRepositoryContext';
import {Header, ScrollContainer} from 'src/ListComponents';
import {Loading} from 'src/Loading';
import {PythonErrorInfo} from 'src/PythonErrorInfo';
import {RepositoryInformation} from 'src/RepositoryInformation';
import {useDocumentTitle} from 'src/hooks/useDocumentTitle';
import {TopNav} from 'src/nav/TopNav';
import {ReconcileButton} from 'src/schedules/ReconcileButton';
import {ScheduleRow, ScheduleStateRow} from 'src/schedules/ScheduleRow';
import {SCHEDULES_ROOT_QUERY, SchedulerTimezoneNote} from 'src/schedules/ScheduleUtils';
import {SchedulerInfo} from 'src/schedules/SchedulerInfo';
import {
  SchedulesRootQuery,
  SchedulesRootQuery_repositoryOrError_Repository,
  SchedulesRootQuery_scheduleDefinitionsOrError_ScheduleDefinitions_results,
  SchedulesRootQuery_scheduleStatesOrError_ScheduleStates_results,
} from 'src/schedules/types/SchedulesRootQuery';
import {Table} from 'src/ui/Table';

const GetStaleReconcileSection: React.FunctionComponent<{
  scheduleDefinitionsWithoutState: SchedulesRootQuery_scheduleDefinitionsOrError_ScheduleDefinitions_results[];
  scheduleStatesWithoutDefinitions: SchedulesRootQuery_scheduleStatesOrError_ScheduleStates_results[];
}> = ({scheduleDefinitionsWithoutState, scheduleStatesWithoutDefinitions}) => {
  if (
    scheduleDefinitionsWithoutState.length === 0 &&
    scheduleStatesWithoutDefinitions.length === 0
  ) {
    return null;
  }

  return (
    <Card style={{backgroundColor: Colors.LIGHT_GRAY4}}>
      <Callout intent={Intent.WARNING}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p>
              There have been changes to the list of schedule definitions in this repository since
              the last time the scheduler state had been reconciled. For the dagster scheduler to
              run schedules, schedule definitions need to be reconciled with the internal schedule
              storage database.
            </p>
            <p>
              To reconcile schedule state, run <Code>dagster schedule up</Code> or click{' '}
              <ReconcileButton />
            </p>
          </div>
        </div>
      </Callout>
      <ScheduleWithoutStateTable schedules={scheduleDefinitionsWithoutState} />
      <ScheduleStatesWithoutDefinitionsTable scheduleStates={scheduleStatesWithoutDefinitions} />
    </Card>
  );
};

export const SchedulesRoot: React.FunctionComponent = () => {
  useDocumentTitle('Schedules');
  const repositorySelector = useRepositorySelector();

  const queryResult = useQuery<SchedulesRootQuery>(SCHEDULES_ROOT_QUERY, {
    variables: {
      repositorySelector: repositorySelector,
    },
    fetchPolicy: 'cache-and-network',
    pollInterval: 50 * 1000,
    partialRefetch: true,
  });

  const breadcrumbs: IBreadcrumbProps[] = [{icon: 'time', text: 'Schedules'}];

  return (
    <ScrollContainer>
      <TopNav breadcrumbs={breadcrumbs} />
      <Loading queryResult={queryResult} allowStaleData={true}>
        {(result) => {
          const {
            scheduler,
            repositoryOrError,
            scheduleDefinitionsOrError,
            scheduleStatesOrError: scheduleStatesWithoutDefinitionsOrError,
          } = result;
          let staleReconcileSection = null;
          let scheduleDefinitionsSection = null;

          if (scheduleDefinitionsOrError.__typename === 'PythonError') {
            scheduleDefinitionsSection = <PythonErrorInfo error={scheduleDefinitionsOrError} />;
          } else if (repositoryOrError.__typename === 'PythonError') {
            scheduleDefinitionsSection = <PythonErrorInfo error={repositoryOrError} />;
          } else if (repositoryOrError.__typename === 'RepositoryNotFoundError') {
            // Should not be possible, the schedule definitions call will error out
          } else if (scheduleDefinitionsOrError.__typename === 'ScheduleDefinitions') {
            const scheduleDefinitions = scheduleDefinitionsOrError.results;
            const scheduleDefinitionsWithState = scheduleDefinitions.filter((s) => s.scheduleState);
            const scheduleDefinitionsWithoutState = scheduleDefinitions.filter(
              (s) => !s.scheduleState,
            );

            if (!scheduleDefinitions.length) {
              scheduleDefinitionsSection = (
                <NonIdealState
                  icon={IconNames.ERROR}
                  title="No Schedules Found"
                  description={
                    <p>
                      This repository does not have any schedules defined. Visit the{' '}
                      <a href="https://docs.dagster.io/overview/scheduling-partitions/schedules">
                        scheduler documentation
                      </a>{' '}
                      for more information about scheduling pipeline runs in Dagster. .
                    </p>
                  }
                />
              );
            } else {
              scheduleDefinitionsSection = (
                <ScheduleTable
                  schedules={scheduleDefinitionsWithState}
                  repository={repositoryOrError}
                />
              );
            }

            if (scheduleStatesWithoutDefinitionsOrError.__typename === 'ScheduleStates') {
              const scheduleStatesWithoutDefinitions =
                scheduleStatesWithoutDefinitionsOrError.results;
              staleReconcileSection = (
                <GetStaleReconcileSection
                  scheduleDefinitionsWithoutState={scheduleDefinitionsWithoutState}
                  scheduleStatesWithoutDefinitions={scheduleStatesWithoutDefinitions}
                />
              );
            }
          }

          return (
            <div style={{padding: '16px'}}>
              <SchedulerInfo schedulerOrError={scheduler} errorsOnly={true} />
              {staleReconcileSection}
              {scheduleDefinitionsSection}
            </div>
          );
        }}
      </Loading>
    </ScrollContainer>
  );
};

const ScheduleTable: React.FunctionComponent<{
  schedules: SchedulesRootQuery_scheduleDefinitionsOrError_ScheduleDefinitions_results[];
  repository: SchedulesRootQuery_repositoryOrError_Repository;
}> = (props) => {
  if (props.schedules.length === 0) {
    return null;
  }

  return (
    <div>
      <div style={{display: 'flex'}}>
        <Header>Schedules</Header>
        <div style={{flex: 1}} />
        <SchedulerTimezoneNote />
      </div>
      <div>
        {`${props.schedules.length} loaded from `}
        <Tooltip
          interactionKind={PopoverInteractionKind.HOVER}
          content={
            <pre>
              <RepositoryInformation repository={props.repository} />
              <div style={{fontSize: 11}}>
                <span style={{marginRight: 5}}>id:</span>
                <span style={{opacity: 0.5}}>{props.repository.id}</span>
              </div>
            </pre>
          }
        >
          <Code>{props.repository.name}</Code>
        </Tooltip>
      </div>

      {props.schedules.length > 0 && (
        <Table striped style={{width: '100%'}}>
          <thead>
            <tr>
              <th style={{maxWidth: '60px'}}></th>
              <th>Schedule Name</th>
              <th>Pipeline</th>
              <th style={{width: '150px'}}>Schedule</th>
              <th style={{width: '100px'}}>Last Tick</th>
              <th>Latest Runs</th>
              <th>Execution Params</th>
            </tr>
          </thead>
          <tbody>
            {props.schedules.map((schedule) => (
              <ScheduleRow schedule={schedule} key={schedule.name} />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

const ScheduleWithoutStateTable: React.FunctionComponent<{
  schedules: SchedulesRootQuery_scheduleDefinitionsOrError_ScheduleDefinitions_results[];
}> = (props) => {
  if (props.schedules.length === 0) {
    return null;
  }

  return (
    <div style={{marginTop: 10, marginBottom: 10}}>
      <h4>New Schedule Definitions</h4>
      <p>
        The following are new schedule definitions for which there are no entries in schedule
        storage yet. After reconciliation, these schedules can be turned on.
      </p>
      {props.schedules.length > 0 && (
        <Table striped style={{width: '100%'}}>
          <thead>
            <tr>
              <th>Schedule Name</th>
              <th>Pipeline</th>
              <th>Schedule</th>
              <th>Execution Params</th>
            </tr>
          </thead>
          <tbody>
            {props.schedules.map((schedule) => (
              <ScheduleRow schedule={schedule} key={schedule.name} />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

interface ScheduleStateTableProps {
  scheduleStates: SchedulesRootQuery_scheduleStatesOrError_ScheduleStates_results[];
}

const ScheduleStatesWithoutDefinitionsTable: React.FunctionComponent<ScheduleStateTableProps> = (
  props,
) => {
  if (props.scheduleStates.length === 0) {
    return null;
  }

  return (
    <div style={{marginTop: 20, marginBottom: 10}}>
      <h4>Deleted Schedule Definitions</h4>
      <p>
        The following are entries in schedule storage for which there is no matching schedule
        definition anymore. This means that the schedule definition has been deleted or renamed.
        After reconciliation, these entries will be deleted.
      </p>
      {props.scheduleStates.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th style={{flex: 1.4}}>Schedule Name</th>
              <th style={{maxWidth: 150}}>Schedule</th>
              <th style={{maxWidth: 100}}>Last Tick</th>
              <th style={{flex: 1}}>Latest Runs</th>
            </tr>
          </thead>
          <tbody>
            {props.scheduleStates.map((scheduleState) => (
              <ScheduleStateRow
                scheduleState={scheduleState}
                key={scheduleState.scheduleOriginId}
              />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};
